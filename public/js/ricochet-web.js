function RicochetWeb(private_key) {
    this.private_key = private_key;
    this.ws = null;
}

RicochetWeb.prototype.close = function() {
    this.ws.close();
};

RicochetWeb.prototype.open = function(ws_url) {
    if (this.ws)
        this.ws.close();
    this.ws = new WebSocket(ws_url);

    let _ricochetweb = this;

    this.ws.onopen = function(e) {
        if (_ricochetweb.private_key) {
            _ricochetweb.ws.send(JSON.stringify({"op":"key","key":_ricochetweb.private_key}));
        } else {
            _ricochetweb.ws.send(JSON.stringify({"op":"generate-key"}));
        }
    };
    this.ws.onclose = function(e) {
        if (_ricochetweb.onclose)
            _ricochetweb.onclose(e);
    };
    this.ws.onerror = function(e) {
        if (_ricochetweb.onwebsocketerror)
            _ricochetweb.onwebsocketerror(e);
    };
    this.ws.onmessage = function(e) {
        let msg = JSON.parse(e.data);

        console.log(msg);

        if (msg.op == "ready") {
            _ricochetweb.private_key = msg.key;
            _ricochetweb.onion = msg.onion;

            if (_ricochetweb.onopen)
                _ricochetweb.onopen(e);
        } else if (msg.op == "connected") {
            if (_ricochetweb.onconnected)
                _ricochetweb.onconnected(msg.onion);
        } else if (msg.op == "new-peer") {
            if (_ricochetweb.onnewpeer)
                _ricochetweb.onnewpeer(msg.onion);
        } else if (msg.op == "peer-ready") {
            if (_ricochetweb.onpeerready)
                _ricochetweb.onpeerready(msg.onion);
        } else if (msg.op == "message") {
            if (_ricochetweb.onmessage)
                _ricochetweb.onmessage(msg.onion, msg.text);
        } else if (msg.op == "disconnected") {
            if (_ricochetweb.ondisconnected)
                _ricochetweb.ondisconnected(msg.onion);
        } else if (msg.op == "error") {
            console.log("ricochet-web.js error: " + msg.text);
            if (_ricochetweb.onerror)
                _ricochetweb.onerror(msg.text);
        }
    };
};

RicochetWeb.prototype.connect = function(onion) {
    this.ws.send(JSON.stringify({"op":"connect","onion":onion}));
};

RicochetWeb.prototype.send = function(onion, message) {
    this.ws.send(JSON.stringify({"op":"send","onion":onion,"text":message}));
};
