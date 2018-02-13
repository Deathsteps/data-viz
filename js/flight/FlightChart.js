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
    // geo objects
    projection: null,
    mapPathGenerator: null,
    linesPathGenerator: null,
    dotsPathGenerator: null,
    // states
    displayedAirlines: null,
    defaultCenter: null,
    defaultScale: 0,
    zoomLevel: 0,

    init: function (complete) {
      // initialize essential members
      d3.select('#earth').style('background', MAP_COLORS[0])

      this.svg = d3.select('svg');
      this.mapCtx = d3.select('#earth').node().getContext('2d');
      this.linesCtx = d3.select('#lines').node().getContext('2d');
      this.dotsCtx = d3.select('#dots').node().getContext('2d');
      this.projection = d3.geoEquirectangular();
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

      this.fetchData().then(function () {
        // initialize projection
        this.projection.fitExtent([[0, 0], [CANVAS_WIDTH, CANVAS_HEIGHT]], this.geojson);
        this.defaultCenter = this.projection.center()
        this.defaultScale = this.projection.scale()
        complete();
      }.bind(this))
    },
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
    getDisplayedRoutes: function () {
      var data = this.flightData
      var displayedAirlines = this.displayedAirlines
      var reader = this.reader

      var routes = data.routes
      if (displayedAirlines) {
        routes = routes.filter(function (route) {
          var airline = data.airlines[reader.route('airlineIndex', route)]
          return displayedAirlines.indexOf(reader.airline('name', airline)) > -1;
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
    drawLines: function () {
      // compute displayed routes
      var displayedRoutes = this.getDisplayedRoutes()
      // reset canvas
      var context = this.linesCtx;
      context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      var geoGenerator = this.linesPathGenerator
      // draw
      context.lineWidth = 0.1;
      context.strokeStyle = LINE_COLORS[0];
      context.beginPath();
      geoGenerator({ type: 'MultiLineString', coordinates: displayedRoutes });
      context.stroke();
    },
    drawDots: function () {
      
    },
    // actions
    filter: function (displayedAirlines) {
      this.displayedAirlines = displayedAirlines
      this.drawLines();
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
      this.displayedAirlines = null;
      this.zoomLevel = 0;
      this.projection.center(this.defaultCenter);
      this.projection.scale(this.defaultScale);
      this.render();
    }
  }

  exports.FlightChart = FlightChart
})(window);