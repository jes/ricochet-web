ricochet = new RicochetWeb();

ricochet.onopen = function(e) {
    console.log("We are ricochet:" + ricochet.onion);
    window.setTimeout(function() {
        console.log("Try to connect...");
        ricochet.connect("7kcnmmzhfo22unr2");
    }, 10000);
};

ricochet.open((window.location.protocol == 'http:' ? "ws://" : "wss://") + window.location.hostname + ":" + window.location.port + "/ws")
