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
  methods: {
    handleReset: function () {
      FlightChart.reset();
    },
    handleInput: debounce(function (input) {
      var country = input.target.value
      var result = FlightChart.countries.filter(function(item){ return item === country })
      if (result.length) {
        FlightChart.filter(result[0]);
      }
    }, 200)
  }
})