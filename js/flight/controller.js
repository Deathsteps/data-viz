function debounce (action, idle){
  var last
  return function(){
    var ctx = this, args = arguments
    clearTimeout(last)
    last = setTimeout(function(){
      action.apply(ctx, args)
    }, idle)
  }
}

Vue.component('controller', {
  template: '#tmplController',
  data: function () {
    return {
      country: '',
      filterCountry: '',
      airport: '',
      displayedAirport: '',
      displayedAirlines: null,
      airlines: null,
      lineWidth: FlightChart.lineWidth
    }
  },
  watch: {
    displayedAirlines: function (newArr) {
      if (newArr) {
        FlightChart.filter(newArr, this.displayedAirport);
      }
    },
    displayedAirport: function (newAirport) {
      if (newAirport) {
        FlightChart.filter(this.displayedAirlines, newAirport);
      }
    },
    lineWidth: function (newLineWidth) {
      FlightChart.setLineWidth(newLineWidth)
    }
  },
  methods: {
    switchMapType: function () {
      FlightChart.switchProjection();
    },
    toggleRoutePoints: function () {
      FlightChart.toggleDots();
    },
    reset: function () {
      FlightChart.reset();
      this.country = '';
      this.filterCountry = '';
      this.airport = '';
      this.displayedAirport = '';
      this.displayedAirlines = null;
      this.airlines = null;
      this.lineWidth = FlightChart.lineWidth
    },
    checkAllAirlines: function () {
      if (this.displayedAirlines.length !== this.airlines.length) {
        this.displayedAirlines = FlightChart.airlines[this.filterCountry];        
      } else {
        this.displayedAirlines = []
      }
    },
    filterAirline: function (airline) {
      // Get displayed airlines without the specified airline
      var newArr = this.displayedAirlines.filter(function(x){ return x !== airline })
      if (newArr.length === this.displayedAirlines.length) {
        // append the airline
        newArr.push(airline)
        // otherwise remove the airline
      }
      this.displayedAirlines = newArr
    },
    handleCountryInput: debounce(function () {
      var country = this.country
      if (FlightChart.countries.indexOf(country) > -1) {
        this.filterCountry = country;
        this.airlines = FlightChart.airlines[country];
        this.displayedAirlines = FlightChart.airlines[country];
      }
    }, 200),
    handleAirportInput: debounce(function () {
      var airport = this.airport
      if (FlightChart.airports.indexOf(airport) > -1) {
        this.displayedAirport = airport
      }
    }, 200)
  }
})