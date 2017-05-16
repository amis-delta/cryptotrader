
var series = [];

var host = connInfo.websocket;
var port = connInfo.port;


var user = document.URL.split('/').pop();

var ws = new WebSocket('ws://' + host + ':' + port);

var pairslist = [];
var prices = {};
var series = [];
var maxPoints = 12 * 60;


var mdKeys = {
  currencyPair: 0,
  last: 1,
  lowestAsk: 2,
  highestBid: 3,
  percentChange: 4,
  baseVolume: 5,
  quoteVolume: 6,
  isFrozen: 7
}
mdKeys['24hrHigh'] = 8;
mdKeys['24hrLow'] = 9;



ws.onopen = () => {
  console.log('Requesting price history...');
  ws.send(JSON.stringify({
    request: 'pricehistory'
  }));
}

ws.onmessage = (data) => {
  let msg = JSON.parse(data.data);
  if (msg.msgType == 'price_update') {
    parseChartDatum(msg);
  }

  if (msg.msgType == 'pricehistory') {
    console.log('price history received');
    parseHistory(msg.response);
  }


}



Highcharts.setOptions({
  global: {
    useUTC: false
  }
});

var myChart;
/* fed an array of series objects */
var createChart = function(series) {
  console.log('chart')
  myChart = Highcharts.stockChart('container', {
    title: {
      text: 'Coin Prices'
    },
    // legend: {
    //   enabled: true,
    //   layout: 'vertical',
    //   align: 'left'
    // },
    tooltip: {
      shared: false
    },
    yAxis: {
      title: {
        text: 'Net Change'
      }
    },
    rangeSelector: {
      buttons: [{
        count: 1,
        type: 'minute',
        text: '1M'
      }, {
        count: 5,
        type: 'minute',
        text: '5M'
      }, {
        type: 'all',
        text: 'All'
      }],
      inputEnabled: true,
      selected: 0
    },
    series: series
  });
  startInterval();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* takes a msg and updates the prices object also adds new series */
var parseChartDatum = function(row, isHistorical) {

  /* loop through each pair in market data */
  row.marketData.forEach( (pair) => {
    /* only btc related pairs */
    if (pair[mdKeys.currencyPair].indexOf('BTC') > -1) {
      /* add pair to list, series init and global structure if new */
      if (pairslist.indexOf(pair[mdKeys.currencyPair]) === -1) {
        pairslist.push(pair[mdKeys.currencyPair]);
        series.push({
          name: pair[mdKeys.currencyPair],
          data: []
        });
      }

      /* update the global record */
      prices[pair[mdKeys.currencyPair]] = parseFloat(pair[mdKeys.percentChange]);
    }

  });

}

var parseHistory = function(res) {
  keys = [];
  /* loop through each historical point */
  res.forEach( (row) => {
    parseChartDatum(row, true);
    /* loop through each pair in one point */
    pairslist.forEach( (pair, i) => {
      if (series[i].length >= maxPoints) {
        series[i].shift();
      }
      series[i].data.push({
        x: row.timestamp,
        y: prices[pair]
      });
    });
  });
  createChart(series);

}


var count = 0;
var startInterval = function() {
  setInterval( () => {
    const ts = new Date().getTime();
    if (count >= 11) {
      pairslist.forEach( (pair, i) => {
        myChart.series[i].addPoint({
          x: ts,
          y: prices[pair]
        }, false);
      });
      count = 0;

    } else {
      pairslist.forEach( (pair, i) => {

        myChart.series[i].data[myChart.series[i].data.length-1].update(
          prices[pair]
        , false)

      });
      count = count + 1;
    }

    myChart.redraw();

  }, 5000);
}
