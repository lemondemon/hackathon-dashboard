angular.module( 'hackaton', [
  'templates-app',
  'templates-common',
  'hackaton.home',
  'ui.router'
])

.config( function myAppConfig ( $stateProvider, $urlRouterProvider ) {
  $urlRouterProvider.otherwise( '/' );
})

.run( function run () {
})

.controller( 'AppCtrl', function AppCtrl ( $scope, $location, $state ) {
  $state.go('home');
})

;

