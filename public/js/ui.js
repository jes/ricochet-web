ricochet = new RicochetWeb();

ricochet.onopen = function(e) {
    // TODO: store ricochet private key in localstorage
    $('#status').html("Online");
    $('#ricochet-id').val("ricochet:" + ricochet.onion);
};

// don't let the browser auto-fill with the user's previous id
$('#ricochet-id').val('');
$('#add-ricochet-id').val('');

var onlinepeers = [];
var offlinepeers = [];

ricochet.onconnected = function(onion) {
    removepeer(offlinepeers, onion);
    addpeer(onlinepeers, onion);

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

    ricochet.connect(onion);
    addpeer(offlinepeers, onion);
    $('#add-contact-modal').hide();
});

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
}

function contact_list(list) {
    var html = '';

    html += "<ul>";
    for (var i = 0; i < list.length; i++) {
        html += "<li>" + escapeHtml(list[i]) + "</li>";
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
