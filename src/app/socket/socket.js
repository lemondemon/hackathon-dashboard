/*global SockJS*/

/**
 * TODO:
 * 1. Socket reconnection rules
 * 2. Check idle time
 * 4. Events
 */
angular.module( 'socket', [])

.service('socketService', function(){
    var me = this;

    me.socket = null;
    me.config = null;
    me.connected = false;
    me.tries = 0;
    me.bus = {
        $broadcast: function(){
            console.log('Socket is not connected to any bus. No notification will be sent to the app');
            console.log('Use socketService.attach($scope) to attach it to the $scope.');
        }
    };

    me._connect = function(){
        var me = this;

        me.tries++;
        if (me._openSocketExists()) {
            me._deleteSocket();
        }
        if (me._canReconnect()) {
            try {
                me.socket = eio('ws://pacific-garden-9547.herokuapp.com');
                //console.log(me, me.socket);
                me._addSocketEvents();
            } catch (e) {
                //TODO: test if this doesn't cause infinite loop
                me.reconnect();
                console.log('Socket connection error: ', e);
            }
        } else {
            me.disconnect();
        }
    };

    me._calculateConnectionTimeout = function () {
        var me = this,
            base = (me.tries % 5 + 1) * me.config.defaultTimeout;

        console.log('Reconnecting...', me.tries);
        return base;
    };

    me._openSocketExists = function () {
        return this.socket;
    };

    me._deleteSocket = function () {
        var me = this;

        me._disconnect();
        delete me.socket;
    };

    me._canReconnect = function () {
        var me = this;

        return me.tries < me.config.maxNumReconnects;
    };

    me.disconnect = function () {
        this._disconnect();
    };

    me._disconnect = function(){
        var me = this;

        if(me.socket){
            me.socket.close();
        }
    };

    me._addSocketEvents = function(){
        var me = this,
            socket = me.socket;

        socket.on('open', function(){
            me._onSocketOpen();

            socket.on('message', me._onSocketMessage.bind(me));
            socket.on('close', me._onSocketClose.bind(me));
            socket.on('error', me._onSocketError.bind(me));
        });
    };

    me._onSocketOpen = function(){
        console.log('Socket open', arguments);
        var me = this;

        me.connected = true;
        me.bus.$broadcast('socketConnect', me);
    };

    me._onSocketClose = function(){
        console.log('Socket close', arguments);
        var me = this;

        me.connected = false;
        me.bus.$broadcast('socketClose', me);
        me.reconnect();
    };

    me._onSocketError = function(){
        console.log('Socket error', arguments);
        var me = this;

        me.connected = false;
        me.bus.$broadcast('socketError', me);
        me.reconnect();
    };

    me._onSocketMessage = function(message){
        var data;

        try {
            data = JSON.parse(message);
            //console.log('Socket message: ', message, data);
            me.bus.$broadcast('socketMessage', message, data, me);
        }catch(e){
            console.log('Error parsing socket message: ', e, message);
        }
    };

    me.attach = function(eventBus){
        this.bus = eventBus;
    };

    me.setConfig = function(config){
        this.config = config;
    };

    me.connect = function(){
        var me = this;

        try {
            me._connect();
        } catch (e) {
            me.reconnect();
        }
    };

    me.send = function(message){
        var me = this;

        if(typeof message === 'object'){
            try {
                message = JSON.stringify(message);
            }catch(e){
                console.log('Error stringifying socket message', message);
            }
        }

        try {
            me.socket.send(message);
            console.log('Sending message through socket: ', message);
        }catch(e){
            console.log('Error sending socket message', me.socket, message);
        }
    };

    me.reconnect = function(){
        var me = this;

        setTimeout(function () {
            me._connect();
        }, me._calculateConnectionTimeout());
    };
});
