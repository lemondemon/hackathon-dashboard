var request = require ('request'),
    async = require ('async'),
    moment = require ('moment'),
    yaml = require ('js-yaml'),
    fs   = require ('fs'),
    express = require ('express'),
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
var server_socket;
var server_connected = false;

var app = express();

app.get('/', function(req, res){
  res.send(JSON.stringify(data));
});

var server = engine.listen(process.env.PORT || 3000);

server.on('connection', function (socket){
    server_socket = socket;
    server_connected = true;
    console.log ('Client connected');

    fetchData();

    socket.on('close', function () {
        server_connected = false;
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
            server_socket.send (data);
            setTimeout (fetchData, 15000);
        }
    });
}


