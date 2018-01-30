document.addEventListener("DOMContentLoaded", function(event) {
  console.log('page ready')

  function initChart() {
    // 基于准备好的dom，初始化echarts实例
    var myChart = echarts.init(document.getElementById('dashboard'));

    // 指定图表的配置项和数据
    var option = {
        title: {
            text: 'Shanghai AQI'
        },
        tooltip: {},
        legend: {},
        xAxis: {},
        yAxis: {},
        series: []
    };

    // 使用刚指定的配置项和数据显示图表。
    myChart.setOption(option);

    return myChart
  }

  function pmV(a, b, c) {
    a = +a; b = +b; c = +c;
    return isNaN(b) ? isNaN(a) ? (isNaN(c) ? '-' : c) : a : b;
  }

  function parse(results) {
    var fields = results.shift()
    // 2013
    //    ...
    //    10
    //        23,21,32,434,5,63,...
    //    11
    //        1,2,3,4,5,6,...
    //    ...
    var data = [];
    // build data
    var value = 0;
    results.slice(26300, results.length)
      .forEach((item) => {
        // var year = item[1]
        // var month = item[2]
        // var day = item[3]
        // var hour = item[4]
        if (+item[1] < 2013) {
          return
        }

        var pm = pmV(item[6], item[7], item[8])
        if (!isNaN(pm)) {
          value += pm
        }
        if (+item[4] === 23) {
          data.push(Math.round(value * 100 / 24) / 100);
          value = 0;
        }
      })

    return data;
  }

  function buildSeries(data) {
    var series = [[],[],[]];
    var endDay = 30, value = 0, idx = 0;
    for (var y = 2013; y < 2016; y++) {
      for (var m = 0; m < 12; m++) {
        endDay = m === 11 ?
          new Date(y + 1, 0, 1) :
          new Date(y, m + 1, 1);
        endDay.setDate(endDay.getDate() - 1);
        endDay = endDay.getDate();

        value = 0;
        for (var j = 0; j < endDay; j++) {
          value += data[idx ++];
        }
        series[y - 2013][m] = Math.round( value * 100 / (endDay + 1)) / 100
      }
    }
    return series;
  }

  function buildOption(beijingSeries, shanghaiSeries) {
    // var years = [2013, 2014, 2015];
    var xAxis = [];
    for (var i = 1; i <= 12; i++) {
      xAxis.push(i)
    }

    var series = [
      {name: 'Beijing PM', type: 'line', data: beijingSeries[2] },
      {name: 'Shanghai PM', type: 'line', data: shanghaiSeries[2] }
    ];
    // 标线
    series[0].markLine = {
        silent: true,
        data: [
          { yAxis: 35 },
          { yAxis: 75 },
          { yAxis: 115 },
          { yAxis: 150 },
          { yAxis: 250 }
        ]
    }

    var legend = {
      data: ['Beijing PM', 'Shanghai PM']
    }

    return {
      xAxis: {
        // name: '月份',
        type: 'category',
        boundaryGap: false,
        axisLabel: {
          formatter: '{value}月'
        },
        data: xAxis
      },
      yAxis: {
        name: 'PM(ug/m^3)',
        // axisLabel: { show: false },
        splitLine: { show: false },
      },
      legend: legend,
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        }
      },
      visualMap: {
        top: 10,
        right: -5,
        pieces: [{
          gt: 0,
          lte: 35,
          color: '#096' //优
        }, {
          gt: 35,
          lte: 75,
          color: '#ffde33' //良
        }, {
          gt: 75,
          lte: 115,
          color: '#ff9933' //轻度污染
        }, {
          gt: 115,
          lte: 150,
          color: '#cc0033' //中度污染
        }, {
          gt: 150,
          lte: 250,
          color: '#660099' //重度污染
        }, {
          gt: 250,
          color: '#7e0023' //严重污染
        }],
        outOfRange: {
          color: '#999'
        }
      },
      graphic: {
        elements: [
          {
            type: 'text',
            top: 200,
            left: 200,
            cursor: 'hand',
            style: {
              text: '2015年',
              textAlign: 'center',
              font: 'bolder 2em "Microsoft YaHei", sans-serif',
              fill: '#aaa'
            }
          }
        ]
      },
      series: series
    };
  }

  function fetchRawData(city, callback) {
    var url = '/data/FiveCitiePMData/' + city + 'PM20100101_20151231.csv'
    Papa.parse(url, {
      download: true,
      worker: true,
      complete: function (results) {
        console.log('data ready')
        // console.log(results)
        if (!results) {
          return
        }
        var data = parse(results.data)
        callback(data)
      }
    })
  }

  function checkAndShow() {
    if (shanghaiSeries && beijingSeries) {
      myChart.setOption(buildOption(beijingSeries, shanghaiSeries));
      myChart.hideLoading()
    }
  }

  var myChart = initChart()
  myChart.showLoading();

  var shanghaiSeries, beijingSeries;

  fetchRawData('Beijing', (data) => {
    beijingSeries = buildSeries(data);
    checkAndShow()
  });
  fetchRawData('Shanghai', (data) => {
    shanghaiSeries = buildSeries(data);
    checkAndShow()
  });

});
