package main

import (
	"crypto/rsa"
	"fmt"
	"github.com/jes/go-ricochet/utils"
	"github.com/jes/ricochetbot"
	"golang.org/x/net/websocket"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"sync"
)

type Message struct {
	Op    string `json:"op"`
	Key   string `json:"key"`
	Onion string `json:"onion"`
	Text  string `json:"text"`
}

type Client struct {
	State      string
	Onion      string
	Bot        *ricochetbot.RicochetBot
	Ws         *websocket.Conn
	PrivateKey *rsa.PrivateKey
}

var masterbot *ricochetbot.RicochetBot

var clientsLock sync.Mutex
var clients map[string][]*Client

// make sure you set c.PrivateKey first
func (c *Client) Begin() {
	onion, _ := utils.GetOnionAddress(c.PrivateKey)
	c.Onion = onion

	clientsLock.Lock()
	defer clientsLock.Unlock()

	// send their contacts list if applicable
	bytes, err := ioutil.ReadFile("contacts/" + c.Onion)
	if err == nil {
		websocket.JSON.Send(c.Ws, Message{Op: "contacts", Text: string(bytes)})
	}

	if clients[onion] != nil {
		c.Bot = clients[onion][0].Bot
		clients[onion] = append(clients[onion], c)
		websocket.JSON.Send(c.Ws, Message{Op: "ready", Key: utils.PrivateKeyToString(c.PrivateKey), Onion: c.Onion})
		for _, peer := range c.Bot.Peers {
			websocket.JSON.Send(c.Ws, Message{Op: "peer-ready", Onion: peer.Onion})
		}
		c.State = "ready"
		return
	}

	clients[onion] = make([]*Client, 0)
	clients[onion] = append(clients[onion], c)

	c.Bot = new(ricochetbot.RicochetBot)
	c.Bot.PrivateKey = c.PrivateKey

	c.Bot.OnReadyToChat = func(peer *ricochetbot.Peer) {
		clientsLock.Lock()
		defer clientsLock.Unlock()

		fmt.Println(peer.Onion + " ready to chat")

		for _, c := range clients[onion] {
			websocket.JSON.Send(c.Ws, Message{Op: "peer-ready", Onion: peer.Onion})
		}
	}
	c.Bot.OnMessage = func(peer *ricochetbot.Peer, message string) {
		clientsLock.Lock()
		defer clientsLock.Unlock()

		fmt.Println(peer.Onion + " sent " + message)

		for _, c := range clients[onion] {
			websocket.JSON.Send(c.Ws, Message{Op: "message", Onion: peer.Onion, Text: message})
		}
	}
	c.Bot.OnConnect = func(peer *ricochetbot.Peer) {
		clientsLock.Lock()
		defer clientsLock.Unlock()

		fmt.Println(peer.Onion + " connected")

		for _, c := range clients[onion] {
			websocket.JSON.Send(c.Ws, Message{Op: "connected", Onion: peer.Onion})
		}
	}
	c.Bot.OnNewPeer = func(peer *ricochetbot.Peer) bool {
		clientsLock.Lock()
		defer clientsLock.Unlock()

		fmt.Println(peer.Onion + " new peer")

		for _, c := range clients[onion] {
			websocket.JSON.Send(c.Ws, Message{Op: "new-peer", Onion: peer.Onion})
		}
		return true
	}
	c.Bot.OnDisconnect = func(peer *ricochetbot.Peer) {
		clientsLock.Lock()
		defer clientsLock.Unlock()

		fmt.Println(peer.Onion + " disconnected")

		for _, c := range clients[onion] {
			websocket.JSON.Send(c.Ws, Message{Op: "disconnected", Onion: peer.Onion})
		}
	}
	c.Bot.OnContactRequest = func(peer *ricochetbot.Peer, name string, msg string) bool {
		clientsLock.Lock()
		defer clientsLock.Unlock()

		fmt.Println(peer.Onion + " contact request")

		for _, c := range clients[onion] {
			websocket.JSON.Send(c.Ws, Message{Op: "message", Onion: peer.Onion, Text: msg})
		}
		return true
	}

	// copy tor access details from "masterbot"
	c.Bot.TorControlAddress = masterbot.TorControlAddress
	c.Bot.TorControlType = masterbot.TorControlType
	c.Bot.TorControlAuthentication = masterbot.TorControlAuthentication

	go c.Bot.Run()

	websocket.JSON.Send(c.Ws, Message{Op: "ready", Key: utils.PrivateKeyToString(c.PrivateKey), Onion: c.Onion})
	c.State = "ready"
}

func (c *Client) HandleSetupMessage(msg Message) {
	switch msg.Op {
	case "key":
		pk, pkerr := utils.ParsePrivateKey([]byte(msg.Key))
		if pk == nil || pkerr != nil {
			websocket.JSON.Send(c.Ws, Message{Op: "error", Text: "can't parse key"})
		} else {
			c.PrivateKey = pk
			c.Begin()
		}

	case "generate-key":
		pk, pkerr := utils.GeneratePrivateKey()
		if pk == nil || pkerr != nil {
			websocket.JSON.Send(c.Ws, Message{Op: "error", Text: "can't generate key"})
		} else {
			c.PrivateKey = pk
			c.Begin()
		}
	}
}

func (c *Client) HandleMessage(msg Message) {
	switch msg.Op {
	case "connect":
		fmt.Println(" >> connect to " + msg.Onion)
		go c.Bot.Connect(msg.Onion, "Connection from a ricochet-web user.")

	case "disconnect":
		fmt.Println(" >> disconnect from " + msg.Onion)
		peer := c.Bot.LookupPeerByHostname(msg.Onion)
		if peer != nil {
			peer.Disconnect()
		}

	case "send":
		fmt.Println(" >> send to " + msg.Onion + ": " + msg.Text)
		peer := c.Bot.LookupPeerByHostname(msg.Onion)
		if peer == nil {
			websocket.JSON.Send(c.Ws, Message{Op: "error", Text: "not connected to any peer called " + msg.Onion})
			return
		}
		peer.SendMessage(msg.Text)

		for _, client := range clients[c.Onion] {
			if client != c {
				websocket.JSON.Send(client.Ws, Message{Op: "you-sent", Onion: msg.Onion, Text: msg.Text})
			}
		}

	case "contacts":
		clientsLock.Lock()
		defer clientsLock.Unlock()

		// don't let people store arbitrary data over 64 Kbytes
		if len(msg.Text) < 65536 {
			filename := "contacts/" + c.Onion
			err := ioutil.WriteFile(filename, []byte(msg.Text), 0600)
			if err != nil {
				fmt.Println("can't write to %s: %v", filename, err)
			}
		}

		for _, client := range clients[c.Onion] {
			if client != c {
				websocket.JSON.Send(client.Ws, Message{Op: "contacts", Text: msg.Text})
			}
		}
	}
}

func (c *Client) Delete() {
	clientsLock.Lock()
	defer clientsLock.Unlock()

	// delete this client from the list
	for i, client := range clients[c.Onion] {
		if client == c {
			clients[c.Onion][i] = clients[c.Onion][len(clients[c.Onion])-1]
			clients[c.Onion] = clients[c.Onion][:len(clients[c.Onion])-1]
			break
		}
	}

	// if he was the last client, shutdown the bot
	if len(clients[c.Onion]) == 0 {
		c.Bot.Shutdown()
		delete(clients, c.Onion)
	}
}

// wsHandler runs once per client
func wsHandler(ws *websocket.Conn) {
	var msg Message

	defer ws.Close()

	var c Client
	c.State = "wait-key"
	c.Ws = ws

	for {
		err := websocket.JSON.Receive(ws, &msg)
		if err == io.EOF || err != nil {
			if err != io.EOF {
				fmt.Printf("error: %v", err)
			}
			c.Delete()
			return
		} else {
			if c.State == "wait-key" {
				// first we need to wait for either "key" or "generate-key"
				c.HandleSetupMessage(msg)
			} else {
				c.HandleMessage(msg)
			}
		}
	}
}

func main() {
	// TODO: configurable datadir
	masterbot = new(ricochetbot.RicochetBot)
	err := masterbot.ManageTor("/tmp/ricochet-web-tor")
	if err != nil {
		log.Fatalf("can't start tor: %v", err)
	}

	clients = make(map[string][]*Client)

	http.Handle("/ws", websocket.Handler(wsHandler))
	http.Handle("/", http.FileServer(http.Dir("public/")))

	err = http.ListenAndServe(":8079", nil)
	if err != nil {
		panic("ListenAndServer: " + err.Error())
	}
}
