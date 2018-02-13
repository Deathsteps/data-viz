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
      filterCountry: '',
      displayedAirlines: null,
      airlines: null
    }
  },
  watch: {
    displayedAirlines: function (newArr) {
      if (newArr) {
        FlightChart.filter(newArr);
      }
    }
  },
  methods: {
    handleReset: function () {
      FlightChart.reset();
      this.filterCountry = '';
      this.displayedAirlines = null;
      this.airlines = null;
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
    handleInput: debounce(function () {
      var country = this.filterCountry.trim()
      if (FlightChart.countries.indexOf(country) > -1) {
        this.airlines = FlightChart.airlines[country]
        this.displayedAirlines = FlightChart.airlines[country]
      }
    }, 200)
  }
})