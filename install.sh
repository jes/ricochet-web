#!/bin/bash
# basic install script for ricochet-web

set -e

if [ ! -e ricochet-web ]; then
    echo -e "Please build ricochet-web first:\n  $ go build" >&2
    exit 1
fi

# create ricochet-web user if there isn't one already
grep -q ^ricochet-web: /etc/passwd || useradd --system --home-dir /var/lib/ricochet-web/ ricochet-web

# create files and directories
cp ricochet-web /usr/local/bin/ricochet-web.new
mv /usr/local/bin/ricochet-web.new /usr/local/bin/ricochet-web
mkdir -p /var/lib/ricochet-web/
chown ricochet-web /var/lib/ricochet-web/ || echo -e "\n\n*** You'll need to change the owner of /var/lib/ricochet-web to whatever user you'll be running ricochet-web as (ricochet-web will need access to the tor control cookie)\n\n------------------\n"

# don't overwrite handwritten systemd unit
if [ -e /etc/systemd/system/ricochet-web.service ]; then
    cmp --quiet ricochet-web.service /etc/systemd/system/ricochet-web.service || echo -e "\n\n*** Your installed systemd unit is different from the default!\n*** You might want to examine changes between /etc/systemd/system/ricochet-web.service and ./ricochet-web.service and decide whether you want to edit your config.\n\n------------------\n"
else
    cp ricochet-web.service /etc/systemd/system/
fi

echo -e "Installed!\nRun:\n\n  $ sudo systemctl start ricochet-web\n\nto start ricochet-web, and:\n\n  $ sudo systemctl enable ricochet-web\n\nto have it start automatically at boot.\n\nIt listens on port 8079. Edit main.go to change this."
