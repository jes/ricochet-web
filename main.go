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
)

type Message struct {
	Op    string `json:"op"`
	Key   string `json:"key"`
	Onion string `json:"onion"`
	Text  string `json:"text"`
	Error string `json:"error"`
}

type Client struct {
	State      string
	Bot        *ricochetbot.RicochetBot
	Ws         *websocket.Conn
	PrivateKey *rsa.PrivateKey
}

var masterbot *ricochetbot.RicochetBot

// make sure you set c.PrivateKey first
func (c *Client) Begin() {
	onion, _ := utils.GetOnionAddress(c.PrivateKey)

	c.Bot = new(ricochetbot.RicochetBot)
	c.Bot.PrivateKey = c.PrivateKey

	c.Bot.OnReadyToChat = func(peer *ricochetbot.Peer) {
		websocket.JSON.Send(c.Ws, Message{Op: "peer-ready", Onion: peer.Onion})
	}
	c.Bot.OnMessage = func(peer *ricochetbot.Peer, message string) {
		websocket.JSON.Send(c.Ws, Message{Op: "message", Onion: peer.Onion, Text: message})
	}
	c.Bot.OnConnect = func(peer *ricochetbot.Peer) {
		websocket.JSON.Send(c.Ws, Message{Op: "connected", Onion: peer.Onion})
	}
	c.Bot.OnNewPeer = func(peer *ricochetbot.Peer) bool {
		websocket.JSON.Send(c.Ws, Message{Op: "new-peer", Onion: peer.Onion})
		return true
	}
	c.Bot.OnDisconnect = func(peer *ricochetbot.Peer) {
		websocket.JSON.Send(c.Ws, Message{Op: "disconnected", Onion: peer.Onion})
	}
	c.Bot.OnContactRequest = func(peer *ricochetbot.Peer, name string, msg string) bool {
		websocket.JSON.Send(c.Ws, Message{Op: "message", Onion: peer.Onion, Text: msg})
		return true
	}

	// copy tor access details from "masterbot"
	c.Bot.TorControlAddress = masterbot.TorControlAddress
	c.Bot.TorControlType = masterbot.TorControlType
	c.Bot.TorControlAuthentication = masterbot.TorControlAuthentication

	go c.Bot.Run()

	websocket.JSON.Send(c.Ws, Message{Op: "ready", Key: utils.PrivateKeyToString(c.PrivateKey), Onion: onion})
	c.State = "ready"
}

func (c *Client) HandleSetupMessage(msg Message) {
	switch msg.Op {
	case "key":
		pk, pkerr := utils.ParsePrivateKey([]byte(msg.Key))
		if pk == nil || pkerr != nil {
			websocket.JSON.Send(c.Ws, Message{Error: "can't parse key"})
		}
		// TODO: make sure we validate key
		c.PrivateKey = pk
		c.Begin()

	case "generate-key":
		pk, pkerr := utils.GeneratePrivateKey()
		if pkerr != nil {
			websocket.JSON.Send(c.Ws, Message{Error: "can't generate key"})
		}
		c.PrivateKey = pk
		c.Begin()
	}
}

func (c *Client) HandleMessage(msg Message) {
	switch msg.Op {
	case "connect":
		go c.Bot.Connect(msg.Onion, "Connection from a ricochet-web user.")

	case "send":
		peer := c.Bot.LookupPeerByHostname(msg.Onion)
		if peer == nil {
			websocket.JSON.Send(c.Ws, Message{Error: "not connected to any peer called " + msg.Onion})
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
		if err == io.EOF {
			c.Bot.Shutdown()
			return
		} else if err != nil {
			fmt.Println("error: %v", err)
			c.Bot.Shutdown()
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

	http.Handle("/ws", websocket.Handler(wsHandler))
	http.Handle("/", http.FileServer(http.Dir("public/")))

	err = http.ListenAndServe(":8079", nil)
	if err != nil {
		panic("ListenAndServer: " + err.Error())
	}
}
