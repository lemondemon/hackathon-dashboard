var request = require ('request'),
    async = require ('async'),
    moment = require ('moment'),
    yaml = require ('js-yaml'),
    fs   = require ('fs'),
    engine = require('engine.io');

var config = yaml.safeLoad (fs.readFileSync (__dirname + '/config.yml', 'utf8'));

var options = {
    url: 'https://github.com/',
    headers: {
        'User-Agent': 'request'
    },
    json: 1
};

var data = {};
var timeout;
var server_socket;
var server_connected = false;

var server = engine.listen(process.env.PORT || 3000);

server.on('connection', function (socket){
    server_socket = socket;
    server_connected = true;
    console.log ('Client connected');

    fetchData();

    socket.on('close', function () {
        server_connected = false;
        clearTimeout (timeout);
        console.log ('Client disconnected');
    });
});


function fetchData () {
    // clear everything
    data = {
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
                            data.events.push ({
                                login: event.actor,
                                type: event.type,
                                repo_owner: event.repository.owner,
                                repo: event.repository.name,
                                branch: event.payload.pull_request.base.ref,
                                title: event.payload.pull_request.title,
                                commits: event.payload.pull_request.commits,
                                additions: event.payload.pull_request.additions,
                                deletions: event.payload.pull_request.deletions,
                                gravatar: event.actor_attributes.gravatar_id,
                                created_at: created.fromNow (),
                                created_unix: created.unix(),
                            });
                            data.counters[event.type]++;

                        } else if (event.type == 'PushEvent') {
                            data.events.push ({
                                login: event.actor,
                                type: event.type,
                                repo_owner: event.repository.owner,
                                repo: event.repository.name,
                                branch: event.payload.ref,
                                gravatar: event.actor_attributes.gravatar_id,
                                created_at: created.fromNow (),
                                created_unix: created.unix(),
                            });
                            data.counters[event.type]++;
                        }
                    }
                }
            }
            callback ();
        });

    }, function (error) {
        data.events.sort (function (a, b) {
            return (b.created_unix - a.created_unix);
        });
        data.timestamp = moment();
        console.log ('Data fetched:', data.timestamp.format(), data.counters);
        
        if (server_connected) {
            var message = {
                type: 'feed',
                data: data
            }
            server_socket.send (JSON.stringify(message));
            timeout = setTimeout (fetchData, 15000);
        }
    });
}


