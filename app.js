var request = require('request');
var async = require('async');
var moment = require('moment');
var yaml = require('js-yaml');
var fs   = require('fs');

var config = yaml.safeLoad (fs.readFileSync(__dirname + '/config.yml', 'utf8'));

var options = {
    url: 'https://github.com/',
    headers: {
        'User-Agent': 'request'
    },
    json: 1
};

var events = [];

async.each (config['participants'], function (participant, callback) {
    //console.log ('---' + participant + '---');

    var participant_options = options;
    participant_options['url'] = 'https://github.com/' + participant + '.json';

    request(participant_options, function (error, response, body) {
        if (!error && response.statusCode == 200) {

            for (var i = 0; i < body.length; i++) {
                var event = body[i];
                var created = moment (event['created_at']);

                if (created.unix() >= moment(config['event_start']).unix()) {

            	    if (event['type'] == 'PullRequestEvent' && event['payload']['action'] == 'opened') {
                		events.push ({
                            login: event['actor'],
                		    type: event['type'],
                		    repo_owner: event['repository']['owner'],
                		    repo: event['repository']['name'],  
                		    title: event['payload']['pull_request']['title'],
                            commits: event['payload']['pull_request']['commits'],
                            additions: event['payload']['pull_request']['additions'],
                            deletions: event['payload']['pull_request']['deletions'],
                            gravatar: event['actor_attributes']['gravatar_id'],
                            created_at: created.fromNow (),
                            created_unix: created.unix(),
                		});

            	    } else if (event['type'] == 'PushEvent') {
                        events.push ({
                            login: event['actor'],
                            type: event['type'],
                            repo_owner: event['repository']['owner'],
                            repo: event['repository']['name'],
                            gravatar: event['actor_attributes']['gravatar_id'],
                            created_at: created.fromNow (),
                            created_unix: created.unix(),
                        });
                    }
                }
            }
            callback ();
        }
    });

}, function (error) {
    events.sort (function (a, b) {
        return (b.created_unix - a.created_unix);
    });
    console.log (events);
});

