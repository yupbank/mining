"use strict";

var getNestedProp = function (obj, propString, fallback) {

  if (!propString) return obj;
  var prop, props = propString.split('.');

  for (var i = 0, iLen = props.length - 1; i <= iLen; i++) {
    prop = props[i];

    if (typeof obj == 'object' && obj !== null && prop in obj) {
      obj = obj[prop];
    }
    else
      return fallback;
  }

  return obj;
};

angular.module('OpenMining', ["highcharts-ng"])

  .run(function($rootScope){
    $rootScope.operators = [
      {key: 'gte', value: 'gte'},
      {key: 'lte', value: 'lte'},
      {key: 'is', value: 'is'},
      {key: 'in', value: 'in'},
      {key: 'between', value: 'between'}
    ];
    $rootScope.types = [
      {key: 'date', value: 'Date'},
      {key: 'int', value: 'Integer'},
      {key: 'str', value: 'String'}
    ];

  })

  .factory('LineChart', function($http){
    var return_val = {
      'getConfig':function(URL){
        return $http.post(URL)
      }
    };
    return return_val;
  })

  .controller('Process',
  function($scope, $http, $location, $timeout) {
    $scope.loading = true;
    $scope.filters = {};

    $scope.$watch('filter_type', function(newVal){
      if(getNestedProp(newVal, 'key', '') == 'date')
        $scope.filter_format = ":Y-:m-:d";
      else
        $scope.filter_format = "";
    });
    $scope.addFilter = function(){
      var chave = 'filter__'+$scope.filter_field+"__"+$scope.filter_operator.key+'__'+$scope.filter_type.key;
      if ($scope.filter_format)
        chave = chave + '__'+$scope.filter_format
      $scope.filters[chave] = $scope.filter_value;
    };
    $scope.removeFilter = function(index){
      delete $scope.filters[index];
    }

    $scope.gridload = function(slug) {
      $scope.process = [];

      var API_URL = "ws://"+ location.host +"/process/" + slug + ".ws?";
      for (var key in $scope.filters){
        API_URL += key + "=" + $scope.filters[key] + "&";
      }

      var sock = new WebSocket(API_URL);
      sock.onmessage = function (e) {
        var data = JSON.parse(e.data);

        if (data.type == 'columns') {
          $scope.columns = data.data;
        }else if (data.type == 'data') {
          $scope.process.push(data.data);
        }else if (data.type == 'close') {
          sock.close();
        }

        $timeout(function(){
          $scope.$apply();
        });

        $scope.loading = false;
      };
    };

    $scope.applyFilters = function(slug){
      $scope.gridload(slug);
    };
    $scope.init = function(slug) {
      $scope.gridload(slug)
    };
  })

  .controller('Chart',
  function($scope, $http, $location, LineChart, $timeout) {
    $scope.loading = true;
    $scope.chartConfig = [];
    $scope.columns = [];
    $scope.process = [];
    $scope.filters = {};

    $scope.$watch('filter_type', function(newVal){
      if(getNestedProp(newVal, 'key', '') == 'date')
        $scope.filter_format = ":Y-:m-:d";
      else
        $scope.filter_format = "";
    });
    $scope.addFilter = function(){
      var chave = 'filter__'+$scope.filter_field+"__"+$scope.filter_operator.key+'__'+$scope.filter_type.key;
      if ($scope.filter_format)
        chave = chave + '__'+$scope.filter_format
      $scope.filters[chave] = $scope.filter_value;
    };
    $scope.removeFilter = function(index){
      delete $scope.filters[index];
    }

    $scope.chartload = function(slug, categorie, type, title){

      var API_URL = "ws://"+ location.host +"/process/" + slug + ".ws?";
      for (var key in $scope.filters){
        API_URL += key + "=" + $scope.filters[key] + "&";
      }
      $scope.columns = [];
      $scope.process = [];
      $scope.chartConfig[slug] = {
        options: {
          chart: {
            type: type
          }
        },
        series: [],
        title: {
          text: title
        },
        xAxis: {
          currentMin: 0,
          categories: []
        }
      };

      var sock = new WebSocket(API_URL);
      sock.onmessage = function (e) {
        var data = JSON.parse(e.data);

        if (data.type == 'columns') {
          $scope.columns = data.data;
        }else if (data.type == 'data') {
          $scope.process.push(data.data);
        }else if (data.type == 'categories') {
          $scope.chartConfig[slug].xAxis.categories = data.data;
        }else if (data.type == 'close') {
          sock.close();
        }

        var loopseries = {};
        for (var j in $scope.process) {
          for (var c in $scope.process[j]) {
            if (typeof loopseries[c] == 'undefined'){
              loopseries[c] = {};
              loopseries[c].data = [];
            }
            loopseries[c].name = c;
            loopseries[c].data.push($scope.process[j][c]);
          }
        }

        $scope.chartConfig[slug].series = [];
        for (var ls in loopseries){
          if (ls != categorie) {
            $scope.chartConfig[slug].series.push(loopseries[ls]);
          }
        }

        $timeout(function(){
          $scope.$apply();
        });
        $scope.loading = false;
      };
    };

    $scope.applyFilters = function(slug, categorie, type, title){
      $scope.chartload(slug, categorie, type, title);
    };
    $scope.init = function(slug, categorie, type, title) {
      $scope.chartload(slug, categorie, type, title);
    };
  });
