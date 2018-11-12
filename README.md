ricochet-web
==============

This is a web interface for Ricochet. See https://ricochet.im/ .

I don't recommend using it for anything important.

You can try out the public instance at https://ricochet-web.org/

Current status
--------------

It works but is quite early days.

See file `NOTES` for things that still need to be done.

Installation
------------

### Basic usage

Clone the repo:

    $ git clone https://github.com/jes/ricochet-web

If you don't already have go and tor, you'll need to install them.

    $ sudo apt install golang-go tor # on Ubuntu
    $ sudo yum install golang tor    # on CentOS

Fetch the dependencies:

    $ go get -d

(This may take a while and produce no output). Build ricochet-web:

    $ go build

After that, you can get started by running:

    $ ./ricochet-web

And visit `http://localhost:8079`.

For now you'll have to edit `main.go` in order to change the port number. Maybe there will be a config file one day.

### Permanent installation

The included script `install.sh` should install `ricochet-web` on Ubuntu and CentOS systems, and hopefully others.

    $ sudo ./install.sh

Having installed `ricochet-web` with `install.sh`, you can start it with systemd:

    $ sudo systemctl start ricochet-web

Examine log output with journalctl:

    $ journalctl -u ricochet-web

Once you're satisfied, you can make it start at boot:

    $ sudo systemctl enable ricochet-web

You'll then want to set up `nginx` or similar in a reverse-proxy configuration. TODO: example nginx config file.

Upgrades
--------

If there is a new version available, and you want to upgrade your running `ricochet-web` instance:

First update the git repo, and fetch any possible updates to the dependencies, and build the new version of the code:

    $ git pull
    $ go get -d -u github.com/jes/ricochetbot github.com/jes/go-ricochet
    $ go build

Run the install script:

    $ sudo ./install.sh

And restart it:

    $ sudo systemctl restart ricochet-web

Contact me
----------

`ricochet-web` is written by James Stanley. You can read my blog at https://incoherency.co.uk/ , email me at
james@incoherency.co.uk, or message me on ricochet at ricochet:it2j3z6t6ksumpzd
