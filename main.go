package main

import (
	"crypto/rsa"
	"fmt"
	"github.com/jes/go-ricochet/utils"
	"github.com/jes/ricochetbot"
	"golang.org/x/net/websocket"
	"io"
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

var haveclientlock sync.Mutex
var haveclient map[string]bool

// make sure you set c.PrivateKey first
func (c *Client) Begin() {
	onion, _ := utils.GetOnionAddress(c.PrivateKey)

	haveclientlock.Lock()
	if haveclient[onion] {
		// TODO: instead of rejecting the new client, maybe we should boot out the old client?
		websocket.JSON.Send(c.Ws, Message{Op: "error", Text: "already have a client with that key"})
		haveclientlock.Unlock()
		return
	}
	haveclient[onion] = true
	haveclientlock.Unlock()

	c.Onion = onion
	c.Bot = new(ricochetbot.RicochetBot)
	c.Bot.PrivateKey = c.PrivateKey

	c.Bot.OnReadyToChat = func(peer *ricochetbot.Peer) {
		fmt.Println(peer.Onion + " ready to chat")
		websocket.JSON.Send(c.Ws, Message{Op: "peer-ready", Onion: peer.Onion})
	}
	c.Bot.OnMessage = func(peer *ricochetbot.Peer, message string) {
		fmt.Println(peer.Onion + " sent " + message)
		websocket.JSON.Send(c.Ws, Message{Op: "message", Onion: peer.Onion, Text: message})
	}
	c.Bot.OnConnect = func(peer *ricochetbot.Peer) {
		fmt.Println(peer.Onion + " connected")
		websocket.JSON.Send(c.Ws, Message{Op: "connected", Onion: peer.Onion})
	}
	c.Bot.OnNewPeer = func(peer *ricochetbot.Peer) bool {
		fmt.Println(peer.Onion + " new peer")
		websocket.JSON.Send(c.Ws, Message{Op: "new-peer", Onion: peer.Onion})
		return true
	}
	c.Bot.OnDisconnect = func(peer *ricochetbot.Peer) {
		fmt.Println(peer.Onion + " disconnected")
		websocket.JSON.Send(c.Ws, Message{Op: "disconnected", Onion: peer.Onion})
	}
	c.Bot.OnContactRequest = func(peer *ricochetbot.Peer, name string, msg string) bool {
		fmt.Println(peer.Onion + " contact request")
		websocket.JSON.Send(c.Ws, Message{Op: "message", Onion: peer.Onion, Text: msg})
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
			if c.Bot != nil {
				c.Bot.Shutdown()
			}
			haveclientlock.Lock()
			haveclient[c.Onion] = false
			haveclientlock.Unlock()
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

	haveclient = make(map[string]bool)

	http.Handle("/ws", websocket.Handler(wsHandler))
	http.Handle("/", http.FileServer(http.Dir("public/")))

	err = http.ListenAndServe(":8079", nil)
	if err != nil {
		panic("ListenAndServer: " + err.Error())
	}
}
