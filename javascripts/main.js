// Generated by CoffeeScript 1.6.3
(function() {
  var activeMarkers, activePolylines, addMapLine, clearMap, createIndividualPlowTrail, createPlowsOnMap, displayNotification, dropMapMarker, getActivePlows, getPlowJobColor, initializeGoogleMaps, map, populateMap, snowAPI;

  snowAPI = "http://dev.hel.fi/aura/v1/snowplow/";

  activePolylines = [];

  activeMarkers = [];

  map = null;

  initializeGoogleMaps = function(callback, time) {
    var helsinkiCenter, mapOptions, styles;
    helsinkiCenter = new google.maps.LatLng(60.193084, 24.940338);
    mapOptions = {
      center: helsinkiCenter,
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: {
        style: google.maps.ZoomControlStyle.SMALL,
        position: google.maps.ControlPosition.RIGHT_BOTTOM
      }
    };
    styles = [
      {
        "stylers": [
          {
            "invert_lightness": true
          }, {
            "hue": "#00bbff"
          }, {
            "weight": 0.4
          }, {
            "saturation": 80
          }
        ]
      }, {
        "featureType": "road.arterial",
        "stylers": [
          {
            "color": "#00bbff"
          }, {
            "weight": 0.1
          }
        ]
      }, {
        "elementType": "labels",
        "stylers": [
          {
            "visibility": "off"
          }
        ]
      }, {
        "featureType": "administrative.locality",
        "stylers": [
          {
            "visibility": "on"
          }
        ]
      }, {
        "featureType": "administrative.neighborhood",
        "stylers": [
          {
            "visibility": "on"
          }
        ]
      }, {
        "featureType": "administrative.land_parcel",
        "stylers": [
          {
            "visibility": "on"
          }
        ]
      }
    ];
    map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);
    map.setOptions({
      styles: styles
    });
    return callback(time);
  };

  dropMapMarker = function(plowJobColor, lat, lng) {
    var marker, snowPlowMarker;
    snowPlowMarker = {
      path: "M10 10 H 90 V 90 H 10 L 10 10",
      fillColor: plowJobColor,
      strokeColor: plowJobColor,
      strokeWeight: 9,
      strokeOpacity: 0.8,
      scale: 0.01
    };
    marker = new google.maps.Marker({
      position: new google.maps.LatLng(lat, lng),
      map: map,
      icon: snowPlowMarker
    });
    marker.setClickable(false);
    activeMarkers.push(marker);
    return marker;
  };

  getPlowJobColor = function(job) {
    switch (job) {
      case "kv":
        return "#84ff00";
      case "au":
        return "#f2c12e";
      case "su":
        return "#d93425";
      case "hi":
        return "#ffffff";
      default:
        return "#6c00ff";
    }
  };

  addMapLine = function(plowData, plowJobId) {
    var plowTrailColor, polyline, polylinePath;
    plowTrailColor = getPlowJobColor(plowJobId);
    polylinePath = _.reduce(plowData, (function(accu, x) {
      accu.push(new google.maps.LatLng(x.coords[1], x.coords[0]));
      return accu;
    }), []);
    polyline = new google.maps.Polyline({
      path: polylinePath,
      geodesic: true,
      strokeColor: plowTrailColor,
      strokeWeight: 1.5,
      strokeOpacity: 0.6
    });
    activePolylines.push(polyline);
    return polyline.setMap(map);
  };

  clearMap = function() {
    _.map(activePolylines, function(polyline) {
      return polyline.setMap(null);
    });
    return _.map(activeMarkers, function(marker) {
      return marker.setMap(null);
    });
  };

  displayNotification = function(notificationText) {
    var $notification;
    $notification = $("#notification");
    return $notification.empty().text(notificationText).slideDown(800).delay(5000).slideUp(800);
  };

  getActivePlows = function(time, callback) {
    var plowPositions;
    $("#load-spinner").fadeIn(400);
    plowPositions = Bacon.fromPromise($.getJSON("" + snowAPI + "?since=" + time));
    plowPositions.onValue(function(json) {
      if (json.length !== 0) {
        callback(time, json);
      } else {
        displayNotification("Ei näytettävää valitulla ajalla");
      }
      return $("#load-spinner").fadeOut(800);
    });
    return plowPositions.onError(function(error) {
      return console.error("Failed to fetch active snowplows: " + (JSON.stringify(error)));
    });
  };

  createIndividualPlowTrail = function(time, plowId, historyData) {
    var filterUnwantedJobs, plowPositions, splitPlowDataByJob;
    splitPlowDataByJob = function(plowData) {
      return _.groupBy(plowData.history, (function(plow) {
        return plow.events[0];
      }), []);
    };
    filterUnwantedJobs = function(groupedPlowData) {
      var whatJobsAreDeSelected;
      whatJobsAreDeSelected = _.flatten(_.map($("#legend [data-selected='false']"), (function(x) {
        return $(x).data("job").split(", ");
      })));
      if (!_.some(whatJobsAreDeSelected, _.partial(_.contains, _.keys(groupedPlowData)))) {
        return groupedPlowData;
      }
    };
    $("#load-spinner").fadeIn(800);
    plowPositions = Bacon.fromPromise($.getJSON("" + snowAPI + plowId + "?since=" + time + "&temporal_resolution=4"));
    plowPositions.filter(function(json) {
      return json.length !== 0;
    }).onValue(function(json) {
      var splittedDataWithoutUnwantedJobs;
      splittedDataWithoutUnwantedJobs = filterUnwantedJobs(splitPlowDataByJob(json));
      _.map(splittedDataWithoutUnwantedJobs, function(oneJobOfThisPlow) {
        return addMapLine(oneJobOfThisPlow, oneJobOfThisPlow[0].events[0]);
      });
      return $("#load-spinner").fadeOut(800);
    });
    return plowPositions.onError(function(error) {
      return console.error("Failed to create snowplow trail for plow " + plowId + ": " + (JSON.stringify(error)));
    });
  };

  createPlowsOnMap = function(time, json) {
    return _.each(json, function(x) {
      return createIndividualPlowTrail(time, x.id, json);
    });
  };

  populateMap = function(time) {
    clearMap();
    return getActivePlows("" + time + "hours+ago", function(time, json) {
      return createPlowsOnMap(time, json);
    });
  };

  $(document).ready(function() {
    var clearUI;
    clearUI = function() {
      $("#notification").stop(true, false).slideUp(200);
      return $("#load-spinner").stop(true, false).fadeOut(200);
    };
    if ($.cookie("info_closed")) {
      $("#info").addClass("off");
    }
    initializeGoogleMaps(populateMap, 24);
    $("#time-filters li").asEventStream("click").throttle(1000).onValue(function(e) {
      e.preventDefault();
      clearUI();
      $("#time-filters li").removeClass("active");
      $("#visualization").removeClass("on");
      return populateMap($(e.currentTarget).data("hours"));
    });
    $("#legend li").asEventStream("click").onValue(function(e) {
      var $job;
      e.preventDefault();
      clearUI();
      $job = $(e.currentTarget);
      if ($job.attr("data-selected") === "true") {
        $job.attr("data-selected", "false");
      } else {
        $job.attr("data-selected", "true");
      }
      return populateMap($("#time-filters .active").data("hours"));
    });
    $("#info-close, #info-button").asEventStream("click").onValue(function(e) {
      e.preventDefault();
      $("#info").toggleClass("off");
      return $.cookie("info_closed", "true", {
        expires: 7
      });
    });
    return $("#visualization-close, #visualization-button").asEventStream("click").onValue(function(e) {
      e.preventDefault();
      return $("#visualization").toggleClass("on");
    });
  });

  console.log("%c                                                                               \n      _________                            .__                                 \n     /   _____/ ____   ______  _  ________ |  |   ______  _  ________          \n     \\_____  \\ /    \\ /  _ \\ \\/ \\/ /\\____ \\|  |  /  _ \\ \\/ \\/ /  ___/          \n     /        \\   |  (  <_> )     / |  |_> >  |_(  <_> )     /\\___ \\           \n    /_______  /___|  /\\____/ \\/\\_/  |   __/|____/\\____/ \\/\\_//____  >          \n            \\/     \\/ .__           |__|     .__  .__             \\/   .___    \n                ___  _|__| ________ _______  |  | |__|_______ ____   __| _/    \n        Sampsa  \\  \\/ /  |/  ___/  |  \\__  \\ |  | |  \\___   // __ \\ / __ |     \n        Kuronen  \\   /|  |\\___ \\|  |  // __ \\|  |_|  |/    /\\  ___// /_/ |     \n            2014  \\_/ |__/____  >____/(____  /____/__/_____ \\\\___  >____ |     \n                              \\/           \\/              \\/    \\/     \\/     \n                  https://github.com/sampsakuronen/snowplow-visualization      \n                                                                               ", "background: #001e29; color: #00bbff");

  console.log("It is nice to see that you want to know how something is made. We are looking for guys like you: http://reaktor.fi/careers/");

}).call(this);
