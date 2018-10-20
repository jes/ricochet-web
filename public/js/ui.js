ricochet = new RicochetWeb();
ricochet.open((window.location.protocol == 'http:' ? "ws://" : "wss://") + window.location.hostname + ":" + window.location.port + "/ws")
