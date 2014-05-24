/**
* Each section of the site has its own module. It probably also has
* submodules, though this boilerplate is too simple to demonstrate it. Within
* `src/app/home`, however, could exist several additional folders representing
* additional modules that would then be listed as dependencies of this one.
* For example, a `note` section could have the submodules `note.create`,
* `note.delete`, `note.edit`, etc.
*
* Regardless, so long as dependencies are managed correctly, the build process
* will automatically take take of the rest.
*
* The dependencies block here is also where component dependencies should be
* specified, as shown below.
*/
angular.module( 'hackaton.home', [
    'ui.router',
    'socket'
    ])

/**
* Each section or module of the site can also have its own routes. AngularJS
* will handle ensuring they are all available at run-time, but splitting it
* this way makes each module more "self-contained".
*/
.config(function config( $stateProvider ) {
    $stateProvider.state( 'home', {
        url: '/home',
        views: {
            "main": {
                controller: 'HomeCtrl',
                templateUrl: 'home/home.tpl.html'
            }
        },
        data:{ pageTitle: 'Home' }
    });
})

.filter('branchName', function() {
    return function(branchPath) {
        var branchParts = branchPath.split("/");
        
        return branchParts.pop();
    };
})

/**
* And of course we define a controller for our route.
*/
.controller( 'HomeCtrl', function HomeController( $scope, socketService ) {
    console.log('home ctrl');

    $scope.counters = {};
    $scope.events = [];
    $scope.eventsQueue = [];

    $scope.labelCounter = 0;
    $scope.lastEventTimestamp = localStorage.getItem('lastEventTimestamp') || 0;

    $scope.pullRequest = {};
    $scope.pullRequestsQueue = [];
    $scope.lastPullRequestTimestamp = localStorage.getItem('lastPullRequestTimestamp') || 0;
    $scope.indicator = 'disconnected';

    var sounds = {
        'mexican': {
            'src': 'assets/audio/mexicanhatdance.mp3',
            'volume': '1'
        },
        'beep': {
            'src': 'assets/audio/beep.mp3',
            'volume': '0.5'
        }
    };

    $scope._playSound = function(sound) {
        console.log('_playSound', sound);
        var audio = new Audio(sounds[sound].src);
        audio.volume = sounds[sound].volume;
        audio.play();
    };

    $scope.handleMessage = function(msg){

        console.log('msg', msg);

        $scope.counters = msg.counters;
        $scope.lastRefresh = new Date(msg.timestamp);
        $scope.eventsQueue = [].concat(msg.events.filter(function(row){
            return row.created_unix > $scope.lastEventTimestamp;
        }), $scope.eventsQueue);
        if(typeof $scope.eventsQueue[0] !== 'undefined'){
            $scope.lastEventTimestamp = $scope.eventsQueue[0].created_unix;
            if($scope.eventsQueue.length > 5){
                localStorage.setItem('lastEventTimestamp', $scope.eventsQueue[5].created_unix);
            }
        }
        $scope.$apply();
    };

    $scope.handlePublicMessage = function(msg){

        console.log('handlePublicMessage', msg);

        if (msg !== '') {
            $scope.publicMessage = msg;
            $scope.showPublicMessage = true;
        } else {
            $scope.showPublicMessage = false;
        }

    };

    $scope.hidePullRequestModal  = function() {
        console.log('hide pull request modal');
        $scope.showPullRequest = false;
        $scope.$apply();
    };


    $scope.handlePullRequestModal = function() {

        console.log('handlePullRequestModal', $scope.pullRequestsQueue);

        var pr = $scope.pullRequestsQueue.pop();

        if(pr) {
            $scope.pullRequest = pr;
            $scope.showPullRequest = true;
            $scope._playSound('mexican');
            $scope.lastPullRequestTimestamp = pr.created_unix;
            localStorage.setItem('lastPullRequestTimestamp', pr.created_unix);
            $scope.$apply();
            setTimeout($scope.hidePullRequestModal, 20000);
        } else {  
            console.log('pull request info not found or already shown');
        }

    };


    $scope.addLabel = function(){

        var row = $scope.eventsQueue.pop();

        if(row){
            console.log('addingLabel', ++$scope.labelCounter, $scope.eventsQueue.length);
            $scope.events.unshift(row);
            if($scope.events.length > 5){
                $scope.events.pop();
            }

            if (!$scope.showPullRequest) {
                $scope._playSound('beep');
            }

            if (row.type == 'PullRequestEvent' && row.created_unix > $scope.lastPullRequestTimestamp) {
                $scope.pullRequestsQueue.unshift(row);
            }

            $scope.$apply();
        }else{
            console.log('label not found', $scope.eventsQueue.length);
        }
    };

    $scope.$on('socketConnect', function(){
        $scope.indicator = 'connected';
        console.log('socket connect listener', arguments);
    });
    $scope.$on('socketClose', function(){
        $scope.indicator = 'disconnected';
        console.log('socket close listener', arguments);
    });
    $scope.$on('socketError', function(){
        $scope.indicator = 'disconnected';
        console.log('socket error listener', arguments);
    });
    $scope.$on('socketMessage', function(event, originalMessage, parsedMessage){
        console.log('socket message listener', arguments);
        if(parsedMessage.type === 'feed'){
            $scope.handleMessage(parsedMessage.data);
        } else if(parsedMessage.type === 'message') {
            $scope.handlePublicMessage(parsedMessage.data);
        }
    });

    socketService.setConfig({
        defaultTimeout: 3000,
        maxNumReconnects: 100
    });
    socketService.attach($scope);
    socketService.connect();

    setInterval($scope.addLabel.bind($scope), 2000);
    setInterval($scope.handlePullRequestModal.bind($scope), 40000);
})

;

