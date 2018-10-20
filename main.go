package main

import (
    "io"
    "net/http"
    "golang.org/x/net/websocket"
    "github.com/jes/ricochetbot"
    "github.com/jes/go-ricochet/utils"
    "crypto/rsa"
)

type Message struct {
    Op string `json:"op"`
    Key string `json:"key"`
    Onion string `json:"onion"`
    Error string `json:"error"`
}

type Client struct {
    State string
    Bot *ricochetbot.RicochetBot
    Ws *websocket.Conn
    PrivateKey *rsa.PrivateKey
}

// make sure you set c.PrivateKey first
func (c *Client) Begin() {
    onion, _ := utils.GetOnionAddress(c.PrivateKey)

    c.Bot = new(ricochetbot.RicochetBot)
    c.Bot.PrivateKey = c.PrivateKey

    /*c.Bot.OnConnect = func ...
    c.Bot.OnNewPeer = func ...
    c.Bot.OnReadyToChat = func ...
    c.Bot.OnMessage = func ...
    c.Bot.OnContactRequest = func ...
    c.Bot.OnDisconnect = func ...*/

    err := c.Bot.ManageTor("/tmp/ricochet-web-tor")
    if err != nil {
        websocket.JSON.Send(c.Ws, Message{Error: "can't start tor: " + err.Error()});
        return
    }

    go c.Bot.Run()

    websocket.JSON.Send(c.Ws, Message{Op:"ready",Key:utils.PrivateKeyToString(c.PrivateKey),Onion:onion})
    c.State = "ready"
}

func (c *Client) HandleSetupMessage(msg Message) {
    switch(msg.Op) {
        case "key":
            pk, pkerr := utils.ParsePrivateKey([]byte(msg.Key))
            if pkerr != nil {
                websocket.JSON.Send(c.Ws, Message{Error:"can't generate key"})
            }
            c.PrivateKey = pk
            c.Begin()

        case "generate-key":
            pk, pkerr := utils.GeneratePrivateKey()
            if pkerr != nil {
                websocket.JSON.Send(c.Ws, Message{Error:"can't generate key"})
            }
            c.PrivateKey = pk
            c.Begin()
    }
}

func (c *Client) HandleMessage(msg Message) {
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
            return
        } else if err != nil {
            // send error
            return
        } else {
            if (c.State == "wait-key") {
                // first we need to wait for either "key" or "generate-key"
                c.HandleSetupMessage(msg)
            } else {
                c.HandleMessage(msg)
            }
        }
    }
}

func main() {
    http.Handle("/ws", websocket.Handler(wsHandler))
    http.Handle("/", http.FileServer(http.Dir("public/")))
    err := http.ListenAndServe(":8079", nil)
    if err != nil {
        panic("ListenAndServer: " + err.Error())
    }
}
