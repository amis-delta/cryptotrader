

var series = [];

var host = '205.178.62.72';

var user = document.URL.split('/').pop();

var ws = new WebSocket('ws://' + host + ':8888');

var bals = {btc: {}, usd: {}};
var keys = [];
var total = {};
var rate = 0
var maxPoints = 8 * 60;


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
    yAxis: {
      title: {
        text: 'Dollar Value'
      },
      tickPositioner: function() {
        let positions = [.1, .2, .3, .4, .5]
        return positions;
      },
      floor: 0,
      ceiling: .5,
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


/* takes a msg and updates the bals object also adds new series */
var parseChartDatum = function(row, isHistorical) {
  let bs = row.balances
  let md = {};

  if (isHistorical) {
    row.marketData.forEach( (coin) => {
      md[coin[0]] = {
        currencyPair: coin[0],
        last: coin[1],
        lowestAsk: coin[2],
        highestBid: coin[3],
        percentChange: coin[4],
        baseVolume: coin[5],
        quoteVolume: coin[6],
        isFrozen: coin[7]
      }
      md[coin[0]]['24hrHigh'] = coin[8];
      md[coin[0]]['24hrLow'] = coin[9];

    })
  } else {
    md = row['marketData'];
  }

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
    let bal = parseFloat(bs[k]['onOrders']) + parseFloat(bs[k]['available'])
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
        bals.btc[k] = 0;
        bals.usd[k] = 0;
      }
    }
    total['btcs'] += bals.btc[k];
    total['usd'] += bals.usd[k]
  });

}

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
      series[i].data.push([
        row.timestamp,
        bals.usd[k]
      ]);
    });
  });
  createChart(series);

}


var count = 0;
var startInterval = function() {
  setInterval( () => {
    let ts = new Date().getTime()
    document.getElementById("total").innerHTML = "Total PL: $" + total['usd'];
    if (count >= 59) {
      keys.forEach( (k, i) => {
        if (series[i].data.length >= maxPoints) {
          series[i].data.shift();
        }
        series[i].data.push({
          x: ts,
          y: bals.usd[k]
        });

        myChart.series[i].addPoint(
          bals.usd[k]
        , false);
      });
      console.log('points added');
      count = 0;

    } else {
      let output ={};
      keys.forEach( (k, i) => {
        /* update internal series structure */
        series[i].data[series[i].data.length-1] = {
          x: ts,
          y: bals.usd[k]
        };

        myChart.series[i].data[myChart.series[i].data.length-1].update(
          bals.usd[k]
        , false)



      });
      count = count + 1;
    }

    myChart.redraw();

  }, 1000);
}
