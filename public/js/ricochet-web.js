function RicochetWeb(private_key) {
    this.private_key = private_key;
}

RicochetWeb.prototype.open = function(ws_url) {
    this.ws = new WebSocket(ws_url);

    let _ricochetweb = this;

    this.ws.onopen = function(e) {
        if (_ricochetweb.onopen)
            _ricochetweb.onopen(e);

        if (_ricochetweb.private_key) {
            _ricochetweb.ws.send(JSON.stringify({"op":"key","privatekey":_ricochetweb.private_key}));
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
        // TODO: handle msg
    };
}

RicochetWeb.prototype.connect_to = function(onion) {
}
