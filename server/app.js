console.log ('App started');

var request = require ('request'),
    async = require ('async'),
    moment = require ('moment'),
    yaml = require ('js-yaml'),
    fs   = require ('fs'),
    url = require ('url'),
    S = require('string'),
    app = require ('express')(),
    http = require ('http').createServer (app).listen (process.env.PORT || 3000),
    engine = require ('engine.io').attach (http);


var config = yaml.safeLoad (fs.readFileSync (__dirname + '/config.yml', 'utf8'));

var options = {
    url: 'https://github.com/',
    headers: {
        'User-Agent': 'request'
    },
    json: 1
};

var feed = {};
var timeout;
var client_socket;
var client_connected = false;
var message = '';

engine.on('connection', function (socket) {
    client_socket = socket;
    client_connected = true;
    console.log ('Client connected');

    fetchData ();
    sendMessage ();

    socket.on('close', function () {
        client_connected = false;
        clearTimeout (timeout);
        console.log ('Client disconnected');
    });
});

// "API" for pushing a public message
app.get('/message', function(req, res){
    var query = url.parse (req.url, true).query;
    if (query.text != undefined) {
        message = query.text;
    } else {
        message = '';
    }

    sendMessage ();
    res.send ('ok');
});


function sendMessage () {
    if (client_connected) {
        var data = {
            type: 'message',
            data: S(message).escapeHTML().s
        }
        client_socket.send (JSON.stringify(data));
    }
}

function fetchData () {
    // clear everything
    feed = {
        timestamp: 0,
        events: [],
        counters: {
            'PullRequestEvent': 0,
            'PushEvent': 0
        }
    };

    async.each (config.participants, function (participant, callback) {
        var participant_options = options;
        participant_options.url = 'https://github.com/' + participant + '.json';

        request(participant_options, function (error, response, body) {
            if (!error && response.statusCode == 200) {

                // iterating through user's github activity
                for (var i = 0; i < body.length; i++) {
                    var event = body[i];
                    var created = moment (event.created_at);

                    if (created.unix() >= moment(config.event_start).unix()) {

                        if (event.type == 'PullRequestEvent' && event.payload.action == 'opened') {
                            feed.events.push ({
                                login: event.actor,
                                type: event.type,
                                repo_owner: event.repository.owner,
                                repo: event.repository.name,
                                branch: event.payload.pull_request.base.ref,
                                title: event.payload.pull_request.title,
                                commits: event.payload.pull_request.commits,
                                additions: event.payload.pull_request.additions,
                                deletions: event.payload.pull_request.deletions,
                                created_at: created.fromNow (),
                                created_unix: created.unix(),
                            });
                            feed.counters[event.type]++;

                        } else if (event.type == 'PushEvent' && event.repository != undefined
                                    && event.payload.shas.length > 0) {
                            console.log (event);
                            feed.events.push ({
                                login: event.actor,
                                type: event.type,
                                repo_owner: event.repository.owner,
                                repo: event.repository.name,
                                branch: event.payload.ref,
                                title: event.payload.shas[0][2],
                                created_at: created.fromNow (),
                                created_unix: created.unix(),
                            });
                            feed.counters[event.type]++;
                        }
                    }
                }
            }
            callback ();
        });

    }, function (error) {
        feed.events.sort (function (a, b) {
            return (b.created_unix - a.created_unix);
        });
        feed.timestamp = moment();
        console.log ('Data fetched:', feed.timestamp.format(), feed.counters);

        if (client_connected) {
            var data = {
                type: 'feed',
                data: feed
            }
            client_socket.send (JSON.stringify(data));
            timeout = setTimeout (fetchData, 15000);
        }
    });
}


