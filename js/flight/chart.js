var res = Vue.compile(document.getElementById('tmplChart').innerHTML.trim())

Vue.component('chart', {
  // template: '#tmplChart',
  props: ['test'],
  render: function (h) {
    Vue.nextTick(function () {
      FlightChart.render()
    })
    return res.render.call(this, h)
  }
})