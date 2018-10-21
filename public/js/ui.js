ricochet = new RicochetWeb();

ricochet.onopen = function(e) {
    // TODO: store ricochet private key in localstorage
    $('#status').html("Online");
    $('#ricochet-id').val("ricochet:" + ricochet.onion);
};

// don't let the browser auto-fill with the user's previous id
$('#ricochet-id').val('');
$('#add-ricochet-id').val('');
$('#add-ricochet-name').val('');

var onion2Nick = {};
var onlinepeers = [];
var offlinepeers = [];
var messagehtml = {};
var viewingonion = '';

ricochet.onconnected = function(onion) {
    removepeer(offlinepeers, onion);
    addpeer(onlinepeers, onion);

    messagehtml[onion] = '';

    ricochet.send(onion, "test");

    console.log("connected");
};

ricochet.onpeerready = function(onion) {
    removepeer(offlinepeers, onion);
    addpeer(onlinepeers, onion);

    console.log("peerready");
};

ricochet.ondisconnected = function(onion) {
    removepeer(onlinepeers, onion);
    addpeer(offlinepeers, onion);
};

ricochet.onmessage = function(onion,msg) {
    add_message(onion, msg, "you");
};

ricochet.open((window.location.protocol == 'http:' ? "ws://" : "wss://") + window.location.hostname + ":" + window.location.port + "/ws")

$('#status').html("<div class=\"spinner\"></div> Connecting");
redraw_contacts();

$('#add-contact-btn').click(function() {
    // TODO: validate contents of add-ricochet-id
    let onion = $('#add-ricochet-id').val();
    onion = onion.replace(/^ricochet:/, '');

    if (havepeer(onlinepeers, onion))
        return;

    onion2Nick[onion] = $('#add-ricochet-name').val();

    ricochet.connect(onion);
    addpeer(offlinepeers, onion);
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

function add_message(peer, message, sender) {
    for (var i = 0; i < 100; i++) 
    messagehtml[peer] += "<div class=\"msg msg-" + sender + "\">" + escapeHtml(message) + "</div><br>";
    $('#messages').html(messagehtml[peer]);
    $('#messages').scrollTop(1000000000);
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
    $('#messages').html(messagehtml[onion]);

    $('#message-input').focus();

    redraw_contacts();
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
        html += "<li data-onion=\"" + escapeHtml(list[i]) + "\">" + escapeHtml(nick) + "</li>";
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
    l.sort();
    redraw_contacts();
}

function removepeer(l, onion) {
    for (var i = 0; i < l.length; i++) {
        if (l[i] == onion) {
            l.splice(i, 1);
            i--;
        }
    }
    redraw_contacts();
}

function havepeer(l, onion) {
    for (var i = 0; i < l.length; i++) {
        if (l[i] == onion)
            return true;
    }
    return false;
}
