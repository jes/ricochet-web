let ricochet;
let onion2Nick = {};
let onlinepeers = [];
let offlinepeers = [];
let unreads = {};
let messagehtml = {};
let viewingonion = '';
let connected = false;
let deleted = {};

if (window.localStorage.getItem("ricochet-web.private-key")) {
    ricochet = new RicochetWeb(window.localStorage.getItem("ricochet-web.private-key"));
    load_contacts();
} else {
    ricochet = new RicochetWeb();
}

ricochet.onopen = function(e) {
    connected = true;
    $('#status').html("Online");
    $('#ricochet-id').val("ricochet:" + ricochet.onion);
    window.localStorage.setItem("ricochet-web.private-key", ricochet.private_key);

    for (var i = 0; i < offlinepeers.length; i++) {
        ricochet.connect(offlinepeers[i]);
    }
};

ricochet.onconnected = function(onion) {
    deleted[onion] = false;
    addpeer(onlinepeers, onion);
    removepeer(offlinepeers, onion);

    if (!messagehtml[onion])
        messagehtml[onion] = '';
};

ricochet.onnewpeer = function(onion) {
    deleted[onion] = false;
    addpeer(onlinepeers, onion);
    removepeer(offlinepeers, onion);

    if (!messagehtml[onion])
        messagehtml[onion] = '';
}

ricochet.onpeerready = function(onion) {
    if (!deleted[onion])
        addpeer(onlinepeers, onion);
    removepeer(offlinepeers, onion);
};

ricochet.ondisconnected = function(onion) {
    addpeer(offlinepeers, onion);
    removepeer(onlinepeers, onion);
};

ricochet.onmessage = function(onion,msg) {
    add_message(onion, msg, "you");
};

ricochet.onerror = function(e) {
    $('#status').html("Error");
    ricochet.close();
    handle_disconnect();
};
ricochet.onwebsocketerror = function(e) {
    $('#status').html("Websocket Error");
    handle_disconnect();
};
ricochet.onclose = function(e) {
    $('#status').html("Offline");
    handle_disconnect();
}

function handle_disconnect() {
    connected = false;

    // move all online peers to offline
    while (onlinepeers.length) {
        let p = onlinepeers[0];
        addpeer(offlinepeers, p);
        removepeer(onlinepeers, p);
    }

    redraw_contacts();
};

// don't let the browser auto-fill with the user's previous id
$('#ricochet-id').val('');
$('#add-ricochet-id').val('');
$('#add-ricochet-name').val('');

function connect() {
    $('#status').html("<div class=\"spinner\"></div> Connecting");
    ricochet.open((window.location.protocol == 'http:' ? "ws://" : "wss://") + window.location.hostname + ":" + window.location.port + "/ws")
}
connect()

redraw_contacts();

// try to reconnect to offline peers every 10 secs
window.setInterval(function() {
    if (!connected) {
        connect();
        return;
    }

    for (var i = 0; i < offlinepeers.length; i++) {
        ricochet.connect(offlinepeers[i]);
    }
}, 10000);

$('#delete-contact-btn').click(function(e) {
    if (confirm("Really delete ricochet:" + viewingonion + " from your contacts?")) {
        if (connected)
            ricochet.disconnect(viewingonion);
        deleted[viewingonion] = true;
        removepeer(onlinepeers, viewingonion);
        removepeer(offlinepeers, viewingonion);
        redraw_contacts();
        save_contacts();
        show_chat(''); // TODO: maybe show the intro box?
        $('.modal').hide();
    }
});

$('#show-intro-box').click(function() {
    $('#intro-box').show();
    $('#chat-box').hide();
    viewingonion = '';
    redraw_contacts();
});

$('#edit-contact-btn').click(function(e) {
    onion2Nick[viewingonion] = $('#edit-ricochet-name').val();
    show_chat(viewingonion);
    redraw_contacts();
    save_contacts();
    $('.modal').hide();
});

$('#add-contact-btn').click(function(e) {
    e.preventDefault()

    // TODO: validate contents of add-ricochet-id
    let onion = $('#add-ricochet-id').val();
    onion = onion.replace(/^ricochet:/, '');

    if (havepeer(onlinepeers, onion) || havepeer(offlinepeers, onion)) {
        show_chat(onion);
        return;
    }

    onion2Nick[onion] = $('#add-ricochet-name').val();

    addpeer(offlinepeers, onion);
    if (connected)
        ricochet.connect(onion);
    if (!messagehtml[onion])
        messagehtml[onion] = '';
    show_chat(onion);
    $('#add-contact-modal').hide();

    $('#add-ricochet-id').val('');
    $('#add-ricochet-name').val('');
});

$('#message-form').submit(function(e) {
    e.preventDefault();
    ricochet.send(viewingonion, $('#message-input').val());
    add_message(viewingonion, $('#message-input').val(), "me");
    $('#message-input').val('');
});

$('#messages').click(function() {
    $('#message-input').focus();
});

function add_message(peer, message, sender) {
    var msghtml = escapeHtml(message);
    msghtml = msghtml.replace(/\n/, "<br>");
    messagehtml[peer] += "<div class=\"msg msg-" + sender + "\">" + msghtml + "</div><br>";
    if (peer == viewingonion) {
        unreads[peer] = 0;
        $('#messages').html(messagehtml[peer]);
        $('#messages').scrollTop(1000000000);
    } else {
        unreads[peer]++;
        redraw_contacts();
    }
}

function show_chat(onion) {
    viewingonion = onion;

    $('#chat-box').show();
    $('#intro-box').hide();

    let nick = onion2Nick[onion];
    if (nick == undefined)
        nick = onion;
    $('#chat-name-span').text(nick);
    $('#message-input').val('');
    $('#messages').html(messagehtml[onion] || '');
    $('#messages').scrollTop(1000000000);

    $('#message-input').focus();

    $('#edit-ricochet-id').val("ricochet:" + onion);
    $('#edit-ricochet-name').val(onion2Nick[onion]||onion);

    unreads[onion] = 0;

    redraw_contacts();
}

function load_contacts() {
    var m = JSON.parse(window.localStorage.getItem("ricochet-web.contacts"));

    if (m == undefined)
        return;

    onion2Nick = m;

    onlinepeers = [];
    offlinepeers = [];
    for (var onion in onion2Nick) {
        offlinepeers.push(onion);
    }
    redraw_contacts();
}

function save_contacts() {
    // remove nicks from onion2Nick for people that are no longer contacts
    var map = {};
    var allcontacts = onlinepeers.concat(offlinepeers);
    for (var i = 0; i < allcontacts.length; i++) {
        map[allcontacts[i]] = onion2Nick[allcontacts[i]];
    }
    onion2Nick = map;

    window.localStorage.setItem("ricochet-web.contacts", JSON.stringify(onion2Nick));
}

function redraw_contacts() {
    if (onlinepeers.length == 0)
        $('#online-contacts-div').hide();
    else
        $('#online-contacts-div').show();

    if (offlinepeers.length == 0)
        $('#offline-contacts-div').hide();
    else
        $('#offline-contacts-div').show();

    $('#online-contacts').html(contact_list(onlinepeers));
    $('#offline-contacts').html(contact_list(offlinepeers));

    $('.contacts-div li').click(function(e) {
        show_chat($(e.currentTarget).data('onion'));
    });

    if (viewingonion != '') {
        if (havepeer(onlinepeers, viewingonion)) {
            $('#chat-status-circle').css('background', '#0c0');
            $('#chat-status-circle').css('border-color', '#0c0');
        } else {
            $('#chat-status-circle').css('background', '#888');
            $('#chat-status-circle').css('border-color', '#888');
        }
    }
}

function contact_list(list) {
    var html = '';

    html += "<ul>";
    for (var i = 0; i < list.length; i++) {
        let nick = onion2Nick[list[i]];
        if (nick == undefined)
            nick = list[i];

        let viewclass = "";
        if (list[i] == viewingonion)
            viewclass= " class=\"viewingonion\"";

        let unreadshtml = "";
        if (unreads[list[i]]) {
            unreadshtml = " <span class=\"unreads\">(" + escapeHtml(unreads[list[i]]) + ")</span>";
        }

        nick = escapeHtml(nick);
        let onion = escapeHtml(list[i]);
        html += "<li id=\"contact-" + onion + "\" data-onion=\"" + onion + "\"" + viewclass + ">" + nick + unreadshtml + "</li>";
    }
    html += "</ul>";

    return html;
}

// https://stackoverflow.com/a/12034334
var entityMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};
function escapeHtml (string) {
  return String(string).replace(/[&<>"'`=\/]/g, function (s) {
    return entityMap[s];
  });
}

function addpeer(l, onion) {
    for (var i = 0; i < l.length; i++) {
        if (l[i] == onion)
            return;
    }
    l.push(onion);
    if (onion2Nick[onion] == undefined)
        onion2Nick[onion] = onion;
    l.sort(function(a,b) { return onion2Nick[a].localeCompare(onion2Nick[b]); });
    save_contacts();
    if (unreads[onion] == undefined)
        unreads[onion] = 0;
    redraw_contacts();
}

function removepeer(l, onion) {
    for (var i = 0; i < l.length; i++) {
        if (l[i] == onion) {
            l.splice(i, 1);
            i--;
        }
    }
    save_contacts();
    redraw_contacts();
}

function havepeer(l, onion) {
    for (var i = 0; i < l.length; i++) {
        if (l[i] == onion)
            return true;
    }
    return false;
}
