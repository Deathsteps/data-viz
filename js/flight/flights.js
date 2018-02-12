function createDataReader (fieldsDefination) {
  var mapping = {}
  for (var i = fieldsDefination.length - 1; i >= 0; i--) {
    mapping[fieldsDefination[i]] = i
  }
  return function (field, data) {
    var idx = mapping[field]
    if (data[0] instanceof Array) {
      // deal with the whole list
      return data.map(function (record) {
        return record[idx]
      })
    } else {
      // deal with one record
      return data[idx]
    }
  }
}

var mapColors = ['#e6fffb', '#08979c', '#00474f']
var lineColors = ['#fa8c16']
var canvasWidth = 1080, canvasHeight = 560

var canvas = d3.select('#earth')
canvas.style('background', mapColors[0])

var context = canvas.node().getContext('2d');
var projection = d3.geoEquirectangular();
var geoGenerator = d3.geoPath()
  .projection(projection)
  .pointRadius(2)
  .context(context);

var geojson = {}
var routes = []

function drawMap () {
  // start draw
  context.lineWidth = 0.4;
  context.strokeStyle = mapColors[2];

  context.beginPath();
  geoGenerator(geojson)
  context.fillStyle = mapColors[1]
  context.fill()
  context.stroke();

  // Graticule
  // var graticule = d3.geoGraticule();
  // context.beginPath();
  // context.strokeStyle = '#ccc';
  // geoGenerator(graticule());
  // context.stroke();
}

function drawLines () {
  context.lineWidth = 0.1;
  context.strokeStyle = lineColors[0];
  context.beginPath();
  geoGenerator({ type: 'MultiLineString', coordinates: routes });
  context.stroke();
}

function getRoutes (data) {
  var reader = {
    airline: createDataReader(data.airlineFields),
    airport: createDataReader(data.airportsFields),
    route: createDataReader(['airlineIndex', 'startAirportIndex', 'endAirportIndex'])
  }

  return (
    data.routes
      // .filter(function (route) {
      //   // filter country
      //   var airline = data.airlines[reader.route('airlineIndex', route)]
      //   return reader.airline('country', airline) === 'China'
      // })
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
}

function zoomMap (center) {
  var mapCenter = projection.invert(center)
  projection.center(mapCenter)
    .scale(1000)
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  drawMap()
  drawLines()
  // remove brush
  d3.select('svg').select('.brush').remove()
  // create a new one
  initBrush()
}

function initBrush () {

  function brushended () {
    var selection = d3.event.selection
    if (selection && selection.length) {
      var start = selection[0]
      var end = selection[1]
      var center = [ (start[0] + end[0])/2, (start[1] + end[1])/2 ]
      zoomMap(center)
    }
  }

  var brush = d3.brush()
    .on('end', brushended);

  d3.select('svg').append('g')
    .attr('class', 'brush')
    .call(brush)
}

// request geo data
d3.json('data/110m.json', function(err, world) {
  // initialize brush
  initBrush()
  // console.log(topojson.mesh(world)); //, world.objects.land
  geojson = topojson.feature(world, world.objects.countries)
  // initialize projection
  projection.fitExtent([[0, 0], [canvasWidth, canvasHeight]], geojson);
  // initialize canvas
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  // draw map
  drawMap()
  // request flights data and draw lines
  d3.json('data/flights.json', function (err, data) {
    // console.log(data)
    routes = getRoutes(data)
    drawLines()
  })
})

// TODO: 
// 多图层结构
// RAF framework
// Pan and zoom, scale level, reset
// Filter flights, select
// Highlight flights, visual bar
// Move dots, when flight count is under specified number


