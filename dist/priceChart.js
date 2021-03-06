
var series = [];

var host = connInfo.websocket;
var port = connInfo.port;


var user = document.URL.split('/').pop();

var ws = new WebSocket('ws://' + host + ':' + port);

var pairslist = [];
var prices = [];
var series = [];
var maxPoints = 12 * 60;

var totals = {};

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
        type: 'hour',
        text: '1H'
      }, {
        count: 2,
        type: 'hour',
        text: '2H'
      }, {
        count: 4,
        type: 'hour',
        text: '4H'
      }, {
        count: 8,
        type: 'hour',
        text: '8H'
      }, {
        type: 'all',
        text: 'All'
      }],
      inputEnabled: false,
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

  totals['sum'] = 0
  totals['avg'] = 0
  totals['count'] = 0
  /* loop through each pair in market data */
  row.marketData.forEach( (pair) => {
    /* only btc related pairs */
    if (pair[mdKeys.currencyPair].indexOf('BTC') > -1) {
      /* add pair to list, series init and global structure if new */
      if (pairslist.indexOf(pair[mdKeys.currencyPair]) === -1) {
        pairslist.push(pair[mdKeys.currencyPair]);
        prices.push([]);
        series.push({
          name: pair[mdKeys.currencyPair],
          data: []
        });
      }

      /* update the global record */
      prices[pairslist.indexOf(pair[mdKeys.currencyPair])] = [
        pair[mdKeys.currencyPair],
        parseFloat(pair[1]),
        parseFloat(pair[2]),
        parseFloat(pair[3]),
        parseFloat(pair[4]),
        parseFloat(pair[5]),
        parseFloat(pair[6]),
        pair[7],
        parseFloat(pair[8]),
        parseFloat(pair[9]),
      ];

      totals['sum'] += parseFloat(pair[mdKeys.percentChange])
      totals['count']++;
    }

  });
  totals['avg'] = totals['sum'] /totals['count'];

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
        y:   prices[pairslist.indexOf(pair)][mdKeys.percentChange]
      });
    });
  });
  createChart(series);

}


var count = 0;
var startInterval = function() {
  setInterval( () => {
    const ts = new Date().getTime();
    document.getElementById("avgchange").innerHTML = "Average Market % Change: " + totals['avg'];
    if (count >= 11) {
      pairslist.forEach( (pair, i) => {
        myChart.series[i].addPoint({
          x: ts,
          y: prices[pairslist.indexOf(pair)][mdKeys.percentChange]
        }, false);
      });
      count = 0;

    } else {
      pairslist.forEach( (pair, i) => {
        try {
          myChart.series[i].data[myChart.series[i].data.length-1].update(
            prices[pairslist.indexOf(pair)][mdKeys.percentChange]
          , false)
        } catch(e) {
          console.log('Cannot update:', pair, 'with balance:', prices[pairslist.indexOf(pair)][mdKeys.percentChange]);
        }

      });
      count = count + 1;
    }

    myChart.redraw();
    dt.clear().rows.add(prices).draw();

  }, 5000);
}

var dt;
$(document).ready(function() {
    dt = $('#priceTable').DataTable( {
        data: prices,
        columns: Object.keys(mdKeys).map( (k) => ({
          title: k,
          render: $.fn.dataTable.render.number(',', '.', 8),
          className: 'dt-body-right'
        }))
    });
} );
