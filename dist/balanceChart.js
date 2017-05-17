
var series = [];

var host = connInfo.websocket;
var port = connInfo.port;


var user = document.URL.split('/').pop();

var ws = new WebSocket('ws://' + host + ':' + port);

var bals = {btc: {}, usd: {}};
var marketdata = {};
var keys = [];
var total = {};
var rate = 0;
var maxPoints = 12 * 60;



ws.onopen = () => {
  ws.send(JSON.stringify({
    user: user,
    request: 'initialize'
  }));

  console.log('Requesting history...');
  ws.send(JSON.stringify({
    user: user,
    request: 'history'
  }));
}

ws.onmessage = (data) => {
  let msg = JSON.parse(data.data);
  if (msg.msgType == 'user_update') {
    parseChartDatum(msg, false);
  }

  if (msg.msgType == 'history') {
    console.log('History received');
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
      text: 'Coin Balances'
    },
    // legend: {
    //   enabled: true,
    //   layout: 'vertical',
    //   align: 'left'
    // },
    tooltip: {
      shared: false
    },
    yAxis: balChartOptions[user].yAxis,
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


/* takes a msg and updates the bals object also adds new series */
var parseChartDatum = function(row, isHistorical) {
  let bs = row.balances
  let md = {};

  row.marketData.forEach( (pair) => {
    md[pair[0]] = {
      currencyPair: pair[0],
      last: pair[1],
      lowestAsk: pair[2],
      highestBid: pair[3],
      percentChange: pair[4],
      baseVolume: pair[5],
      quoteVolume: pair[6],
      isFrozen: pair[7]
    }
    md[pair[0]]['24hrHigh'] = pair[8];
    md[pair[0]]['24hrLow'] = pair[9];

    marketdata[pair[0]] = pair;
  });


  /* loop through each coin in account balances */
  Object.keys(bs).forEach( (b) => {
    if (bs[b]['btcValue'] > 0 && keys.indexOf(b) === -1) {
      keys.push(b);
      series.push({
        name: b,
        data: []
      });
    }
  });
  total['btcs'] = 0;
  total['usd'] = 0;
  try {
    rate = ((parseFloat(md['USDT_BTC']['lowestAsk']) + parseFloat(md['USDT_BTC']['highestBid'])) / 2);
  } catch (e) {
    console.log('No USDT rate available');
    rate = 0;
  }
  keys.forEach( (k) => {
    let bal = 0
    try {
      bal = parseFloat(bs[k]['onOrders']) + parseFloat(bs[k]['available']);
    } catch(e) {
      console.log('No balance for:', k)
    }
    if (k == 'USDT') {
      bals.btc[k] = bal / rate;
      bals.usd[k] = bal;
    } else if (k == 'BTC') {
      bals.btc[k] = bal;
      bals.usd[k] = bal * rate;
    } else {
      try {
        bals.btc[k] = bal  * ((parseFloat(md['BTC_' + k]['lowestAsk']) + parseFloat(md['BTC_' + k]['highestBid'])) / 2);
        bals.usd[k] = bals.btc[k] * rate;
      } catch (e) {
        console.log('No market data available for:', k);
      }
    }
    total['btcs'] += bals.btc[k];
    total['usd'] += bals.usd[k]
  });

}
var hist;
var parseHistory = function(res) {
  keys = [];
  /* loop through each historical point */
  res.forEach( (row) => {
    parseChartDatum(row, true);
    /* loop through each coin in one point */
    keys.forEach( (k, i) => {
      if (series[i].length >= maxPoints) {
        series[i].shift();
      }
      series[i].data.push({
        x: row.timestamp,
        y: bals.usd[k]
      });
    });
  });
  createChart(series);

}


var count = 0;
var startInterval = function() {
  setInterval( () => {
    const ts = new Date().getTime();
    document.getElementById("total").innerHTML = "Total PL: $" + total['usd'];

    if (count >= 11) {
      keys.forEach( (k, i) => {
        const b = bals.usd[k];
        myChart.series[i].addPoint({
          x: ts,
          y: b
        }, false, false, false);
      });

      count = 0;

    } else {
      keys.forEach( (k, i) => {
        const b = bals.usd[k];
        try {
          myChart.series[i].data[myChart.series[i].data.length-1].update(
            b
          , false, false)
        } catch(e) {
          console.log('Cannot update:', key, 'with balance:', b);
        }
      });
      count = count + 1;
    }

    myChart.redraw();

  }, 5000);
}
