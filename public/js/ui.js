let ricochet;
let onion2Nick = {};
let onlinepeers = [];
let offlinepeers = [];
let unreads = {};
let messagehtml = {};
let viewingonion = '';
let connected = false;
let deleted = {};
let pending_reload = false;
let lastFocusState = document.hasFocus();

if (window.localStorage.getItem("ricochet-web.private-key")) {
    ricochet = new RicochetWeb(window.localStorage.getItem("ricochet-web.private-key"));
} else {
    ricochet = new RicochetWeb();
}

load_contacts();

ricochet.onopen = function(e) {
    connected = true;
    $('#status').html("Online");
    $('#ricochet-id').val("ricochet:" + ricochet.onion);
    $('#intro-ricochet-id').val("ricochet:" + ricochet.onion);
    window.localStorage.setItem("ricochet-web.private-key", ricochet.private_key);
    $('#private-key-textarea').val(ricochet.private_key);

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

ricochet.onyousent = function(onion, msg) {
    add_message(onion, msg, "me");
};

ricochet.oncontacts = function(contacts_map) {
    onion2Nick = contacts_map;

    for (var onion in onion2Nick) {
	if (!havepeer(onlinepeers, onion) && !havepeer(offlinepeers, onion))
		offlinepeers.push(onion);
    }

    save_contacts();
    redraw_title();
    redraw_contacts();
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
    if (pending_reload)
        window.location.reload();
    else
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
$('#edit-ricochet-name').val('');

function connect() {
    $('#status').html("<div class=\"spinner\"></div> Connecting");
    ricochet.open((window.location.protocol == 'http:' ? "ws://" : "wss://") + window.location.host + "/ws")
}
connect()

redraw_contacts();
redraw_title();

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

$('#new-identity').click(function() {
    if (!confirm("Are you sure you want to lose access to " + $('#ricochet-id').val() + "?"))
        return;

    if ((onlinepeers.length > 0 || offlinepeers.length > 0) && confirm("Do you also want to forget all of your contacts?")) {
        window.localStorage.removeItem("ricochet-web.contacts");
    }

    window.localStorage.removeItem("ricochet-web.private-key");

    if (connected) {
        pending_reload = true;
        ricochet.close();
    } else {
        window.location.reload();
    }
});

$('#import-identity').click(function() {
    if (!confirm("Are you sure you want to lose access to " + $('#ricochet-id').val() + "?"))
        return;

    if ((onlinepeers.length > 0 || offlinepeers.length > 0) && confirm("Do you also want to forget all of your contacts?")) {
        window.localStorage.removeItem("ricochet-web.contacts");
    }

    // TODO: validate key
    window.localStorage.setItem("ricochet-web.private-key", $('#private-key-textarea').val());

    if (connected) {
        pending_reload = true;
        ricochet.close();
    } else {
        window.location.reload();
    }
});

function checkFocus() {
    if (document.hasFocus() == lastFocusState)
        return;

    lastFocusState = document.hasFocus();
    if (lastFocusState) { // we now have focus
        unreads[viewingonion] = 0;
        redraw_title();
        redraw_contacts();
    }
}

window.setInterval(checkFocus, 200);

$('#ricochet-id').click(function() {
    $('#ricochet-id').select();
});
$('#intro-ricochet-id').click(function() {
    $('#intro-ricochet-id').select();
});
$('#edit-ricochet-id').click(function() {
    $('#edit-ricochet-id').select();
});

$('#delete-contact-btn').click(function(e) {
    if (!confirm("Really delete ricochet:" + viewingonion + " from your contacts?"))
        return;

    if (connected)
        ricochet.disconnect(viewingonion);
    deleted[viewingonion] = true;
    unreads[viewingonion] = 0;
    removepeer(onlinepeers, viewingonion);
    removepeer(offlinepeers, viewingonion);
    redraw_title();
    redraw_contacts();
    save_contacts();
    if (connected)
        ricochet.send_contacts(onion2Nick);
    show_chat(''); // TODO: maybe show the intro box?
    $('.modal').hide();
});

$('#show-intro-box').click(function() {
    $('#intro-box').show();
    $('#chat-box').hide();
    viewingonion = '';
    redraw_contacts();
});

$('#edit-contact-form').submit(function(e) {
    e.preventDefault()
    onion2Nick[viewingonion] = $('#edit-ricochet-name').val();
    show_chat(viewingonion);
    redraw_contacts();
    save_contacts();
    if (connected)
        ricochet.send_contacts(onion2Nick);
    $('.modal').hide();
});

$('#add-contact-form').submit(function(e) {
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
    $('.modal').hide();
});

$('#message-form').submit(function(e) {
    e.preventDefault();
    ricochet.send(viewingonion, $('#message-input').val());
    add_message(viewingonion, $('#message-input').val(), "me");
    $('#message-input').val('');
});

$('#messages').click(function(e) {
    if ($(e.target).is("#messages"))
        $('#message-input').focus();
});

function show_add_contact(id) {
    $('#add-contact-modal').show();
    $('#add-ricochet-id').val("ricochet:" + id);
    $('#add-ricochet-name').focus();
}

function add_message(peer, message, sender) {
    var msghtml = escapeHtmlLax(message);
    msghtml = msghtml.replace(/\n/g, "<br>");
    msghtml = msghtml.replace(/ricochet:([0-9a-z]{16})/g, function(match, ricochetid, offset, string) {
        return "<span class=\"pointer\" onclick=\"show_add_contact('" + ricochetid + "')\">" + match + "</span>";
    });
    msghtml = msghtml.replace(/(https?:\/\/(?:\.?[^\.\s\(\)"]+(?:\([^\s\(\)"]+\))?(?:\"[^\s\(\)"]+\")?)*)/g, function(match, url, offset, string) {
        url = url.replace(/"/g, '&quot;'); // XXX: since we only "escapeHtmlLax", we need to encode quotes here before they go in href=
        return "<a target=\"_blank\" class=\"pointer\" href=\"" + url + "\">" + url + "</a>";
    });
    if (messagehtml[peer] == undefined)
        messagehtml[peer] = '';
    messagehtml[peer] += "<div class=\"msg msg-" + sender + "\">" + msghtml + "</div><br>";
    if (peer == viewingonion) {
        $('#messages').html(messagehtml[peer]);
        $('#messages').scrollTop(1000000000);
    }
    if (peer != viewingonion || !document.hasFocus()) {
        unreads[peer]++;
        redraw_title();
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
    $('#edit-ricochet-name').val(onion2Nick[onion]);

    unreads[onion] = 0;
    redraw_title();

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

function redraw_title() {
    let totalunread = 0;
    for (var peer in unreads) {
        totalunread += unreads[peer];
    }
    if (totalunread > 0)
        document.title = "(" + totalunread + ") ricochet-web";
    else
        document.title = "ricochet-web";
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
  '`': '&#x60;',
  '=': '&#x3D;'
};
function escapeHtml (string) {
  return String(string).replace(/[&<>"'`=]/g, function (s) {
    return entityMap[s];
  });
}
var entityMapLax = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};
function escapeHtmlLax (string) {
  return String(string).replace(/[&<>]/g, function (s) {
    return entityMapLax[s];
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
