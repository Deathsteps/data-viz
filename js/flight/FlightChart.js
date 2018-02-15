(function(exports){
  function unique (array){ 
    var dict = {}, item; 
    for (var i = array.length - 1; i >= 0; i--) {
      item = array[i]
      if (!dict[item]) { 
        dict[item] = true; 
      }
    }
    return Object.keys(dict); 
  }

  function createDataReader (fieldsDefination, readList) {
    var mapping = {}
    for (var i = fieldsDefination.length - 1; i >= 0; i--) {
      mapping[fieldsDefination[i]] = i
    }
    if (readList) {
      return function (field, data) {
        var idx = mapping[field]
        // deal with the whole list
        return data.map(function (record) {
          return record[idx]
        })
      }
    } else {
      return function (field, data) {
        var idx = mapping[field]
        // deal with one record
        return data[idx]
      }
    }
  }

  // constants
  var MAP_COLORS = ['#e6fffb', '#5cdbd3', '#006d75']
  var LINE_COLORS = ['#eb2f96']
  var DOT_COLORS = ['#fa8c16']
  var CANVAS_WIDTH = 1080, CANVAS_HEIGHT = 560

  var FlightChart = {
    inited: false,
    // canvas contexts
    mapCtx: null,
    linesCtx: null,
    dotsCtx: null,
    svg: null,
    // data reader
    reader: null,
    // data
    geojson: null,
    flightData: null,
    countries: null,
    airlines: null,
    airports: null,
    // geo objects
    projectionType: 'geoEquirectangular', // geoOrthographic
    projection: null,
    mapPathGenerator: null,
    linesPathGenerator: null,
    dotsPathGenerator: null,
    // states
    defaultCenter: null,
    defaultScale: 0,
    filtering: false,
    displayedRoutes: null,
    displayedAirlines: null,
    displayedAirport: '',
    zoomLevel: 0,
    lineWidth: 0.1,
    dotsDisplayed: false,
    // animation related
    spinTimer: null,
    dotsTimer: null,

    init: function (complete) {
      // initialize essential members
      d3.select('#dashboard').style('background', MAP_COLORS[0])

      this.svg = d3.select('svg');
      this.mapCtx = d3.select('#earth').node().getContext('2d');
      this.linesCtx = d3.select('#lines').node().getContext('2d');
      this.dotsCtx = d3.select('#dots').node().getContext('2d');
      this.initGeo();

      this.fetchData().then(function () {
        // initialize projection
        this.projection.fitExtent([[0, 0], [CANVAS_WIDTH, CANVAS_HEIGHT]], this.geojson);
        this.defaultCenter = this.projection.center()
        this.defaultScale = this.projection.scale()
        complete();
      }.bind(this))
    },
    initGeo: function () {
      this.projection = d3[this.projectionType]();
      this.mapPathGenerator = d3.geoPath()
        .projection(this.projection)
        .pointRadius(2)
        .context(this.mapCtx);
      this.linesPathGenerator = d3.geoPath()
        .projection(this.projection)
        .pointRadius(2)
        .context(this.linesCtx);
      this.dotsPathGenerator = d3.geoPath()
        .projection(this.projection)
        .pointRadius(2)
        .context(this.dotsCtx);
      if (this.geojson) {
        this.projection.fitExtent([[0, 0], [CANVAS_WIDTH, CANVAS_HEIGHT]], this.geojson);
      }
    },
    // main
    render: function () {
      if (!this.inited) {
        this.init(function() {
          this.drawMap();
          this.drawLines();
          this.drawBrush();
          this.inited = true;
        }.bind(this))
      } else {
        this.drawMap();
        this.drawLines();
        this.drawBrush();
      }
    },
    startSpin: function () {
      var yaw = 0;
      var duration = 100;// one degree per 100ms
      var ease = d3.easeLinear;
      this.spinTimer = d3.timer(function (elapsed) {
        // compute yaw
        yaw = ease(elapsed / duration)
        // update projection
        this.projection.rotate([yaw]);
        // update ui
        this.drawMap();
        this.drawGraticule();
        this.drawLines(elapsed);
      }.bind(this));
    },
    stopSpin: function () {
      this.spinTimer && this.spinTimer.stop();
    },
    // data related
    fetchData: function () {
      var _this = this
      var promiseGEO = new Promise(function (resolve, reject) {
        d3.json('data/110m.json', function(err, world) {
          _this.geojson = topojson.feature(world, world.objects.countries)
          resolve(world)
        });
      })
      var promiseFlights = new Promise(function (resolve, reject) {
        d3.json('data/flights.json', function(err, data) {
          _this.flightData = data
          // build data reader
          _this.reader = {
            airline: createDataReader(data.airlineFields),
            airport: createDataReader(data.airportsFields),
            route: createDataReader(['airlineIndex', 'startAirportIndex', 'endAirportIndex'])
          }
          _this.countries = _this.getCountries(data)
          _this.airlines = _this.getAirlines(data)
          _this.airports = _this.getAirports(data)
          resolve(data)
        });
      })
      return Promise.all([promiseGEO, promiseFlights])
    },
    getCountries: function (data) {
      var readAirline = createDataReader(data.airlineFields, true)
      return unique(readAirline('country', data.airlines))
    },
    getAirlines: function (data) {
      var readAirline = this.reader.airline;
      var ret = {}
      data.airlines.forEach(function(record) {
        var country = readAirline('country', record)
        var name = readAirline('name', record)
        if (ret[country]) {
          ret[country].push(name)
        } else {
          ret[country] = [name]
        }
      })
      return ret
    },
    getAirports: function (data) {
      var readAirport = createDataReader(data.airportsFields, true)
      return unique(readAirport('name', data.airports))
    },
    getDisplayedRoutes: function () {
      var data = this.flightData
      var displayedAirlines = this.displayedAirlines
      var displayedAirport = this.displayedAirport
      var reader = this.reader

      var routes = data.routes
      // filter airline
      if (displayedAirlines) {
        routes = routes.filter(function (route) {
          var airline = data.airlines[reader.route('airlineIndex', route)]
          return displayedAirlines.indexOf(reader.airline('name', airline)) > -1;
        })
      }
      // filter airport
      if (displayedAirport) {
        routes = routes.filter(function (route) {
          var startAirport = data.airports[reader.route('startAirportIndex', route)]
          var endAirport = data.airports[reader.route('endAirportIndex', route)]
          return (
            displayedAirport === reader.airport('name', startAirport) ||
            displayedAirport === reader.airport('name', endAirport)
          );
        })
      }
      return (
        routes
          .map(function (route) {
            var airports = [
              data.airports[reader.route('startAirportIndex', route)],
              data.airports[reader.route('endAirportIndex', route)]
            ]
            return airports.map(function(airport) {
              return [
                reader.airport('longitude', airport),
                reader.airport('latitude', airport)
              ]
            })
          })
      );
    },
    // render methods
    drawBrush: function () {
      var _this = this
      function brushended () {
        var selection = d3.event.selection
        if (selection && selection.length) {
          var start = selection[0]
          var end = selection[1]
          var center = [ (start[0] + end[0])/2, (start[1] + end[1])/2 ]
          _this.zoomMap(center)
        }
      }

      var brush = d3.brush()
        .on('end', brushended);

      this.svg.append('g')
        .attr('class', 'brush')
        .call(brush)
    },
    drawMap: function () {
      var context = this.mapCtx;
      context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      var geoGenerator = this.mapPathGenerator
      // draw
      context.lineWidth = 0.4;
      context.strokeStyle = MAP_COLORS[2];
      context.beginPath();
      geoGenerator(this.geojson)
      context.fillStyle = MAP_COLORS[1]
      context.fill()
      context.stroke();
      
    },
    drawGraticule: function () {
      var context = this.mapCtx;
      var geoGenerator = this.mapPathGenerator
      var graticule = d3.geoGraticule();
      context.lineWidth = 0.2;
      context.strokeStyle = '#aaa';
      context.beginPath();
      geoGenerator(graticule());
      context.stroke();
    },
    drawLines: function (elapsed) {
      // compute displayed routes
      if (this.filtering || !this.displayedRoutes) {
        this.displayedRoutes = this.getDisplayedRoutes();
      }
      // reset canvas
      var context = this.linesCtx;
      context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      var geoGenerator = this.linesPathGenerator
      // draw
      context.lineWidth = this.lineWidth;
      context.strokeStyle = LINE_COLORS[0];
      context.beginPath();
      geoGenerator({ type: 'MultiLineString', coordinates: this.displayedRoutes });
      context.stroke();
      // draw dots
      if (this.dotsDisplayed) {
        this.drawDots(elapsed);
      }
    },
    drawDots: function (elapsed) {
      var routes = this.displayedRoutes;
      var context = this.dotsCtx;
      var geoGenerator = this.dotsPathGenerator;

      var projectionType = this.projectionType;
      var geoInterpolators = routes.map(function (route) {
        return d3.geoInterpolate(route[0], route[1])
      });
      var ease = d3.easeCubic;
      var duration = 3000; // the whole animation time
      var move = function (elapsed) {
        // compute how far through the animation we are (0 to 1)
        if (projectionType === 'geoOrthographic') {
          var realElapsed = elapsed - (this.dotsTimer || 0);
          var t = Math.min(1, ease(realElapsed / duration));
        } else {
          var t = Math.min(1, ease(elapsed / duration));
        }
        // draw dots
        context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        context.beginPath();
        context.fillStyle = DOT_COLORS[0];
        geoGenerator({
          "type": "MultiPoint",
          "coordinates": geoInterpolators.map(function (interpolate) {
            return interpolate(t)
          })
        })
        context.fill();
        // start a new loop after 1s
        if (t === 1) {
          if (projectionType === 'geoEquirectangular') {
            this.dotsTimer.restart(move, 1000);
          } else {
            // remember the restart time
            this.dotsTimer = elapsed;
          }
        }
      }.bind(this);
      
      if (projectionType === 'geoEquirectangular') {
        if (this.dotsTimer) {
          this.stopMoveDots();
        }
        this.dotsTimer = d3.timer(move); 
      } else {
        // move dots in spin animation timer
        if (elapsed) {
          return move(elapsed);
        }  
      }
      
    },
    stopMoveDots: function () {
      if (this.projectionType === 'geoEquirectangular') {
        this.dotsTimer && this.dotsTimer.stop();
      }
      this.dotsTimer = null;
      this.dotsCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    },
    // actions
    switchProjection: function () {
      if (this.projectionType === 'geoEquirectangular') {
        this.projectionType = 'geoOrthographic'
        this.initGeo();
        this.startSpin();
      } else {
        this.stopSpin();
        this.projectionType = 'geoEquirectangular'
        this.initGeo();
        this.render();
      }
    },
    toggleDots: function () {
      if (!this.displayedRoutes || !this.displayedRoutes.length) {
        return;
      }
      if (this.displayedRoutes.length > 30) {
        return alert('Too much routes, routes count must be less than 30')
      }
      if (this.dotsDisplayed) {
        this.dotsDisplayed = false;
        this.stopMoveDots(); 
      } else {
        this.dotsDisplayed = true;
        this.drawDots();
      }
    },
    setLineWidth: function (lineWidth) {
      this.lineWidth = lineWidth;
      this.drawLines();
    },
    filter: function (displayedAirlines, displayedAirport) {
      this.displayedAirlines = displayedAirlines;
      this.displayedAirport = displayedAirport;
      this.filtering = true;
      this.drawLines();
      this.filtering = false;
    },
    zoomMap: function (center) {
      // remove brush
      this.svg.select('.brush').remove();
      // center chart
      var mapCenter = this.projection.invert(center);
      this.zoomLevel ++
      this.projection
        .center(mapCenter)
        .scale(this.defaultScale + this.zoomLevel * 200);
      this.render();
    },
    reset: function () {
      this.displayedAirlines = null
      this.displayedAirport = ''
      this.zoomLevel = 0;
      this.lineWidth = 0.1;
      this.dotsDisplayed = false;
      this.stopMoveDots();
      this.stopSpin();
      this.projection.center(this.defaultCenter);
      this.projection.scale(this.defaultScale);
      this.render();
    }
  }

  exports.FlightChart = FlightChart
})(window);