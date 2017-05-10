var series = [];

var host = '205.178.62.72';
// host = 'localhost';

var user = document.URL.split('/').pop();

var ws = new WebSocket('ws://' + host + ':8888');

var bals = {};
var keys = [];
var total = {};
var rate = 0

var chartLow = 0
var chartHigh = .0003;
var maxPoints = 60 * 8;

if (user=='will') { chartLow = .085; chartHigh = .095;}

ws.onopen = () => {
  ws.send(JSON.stringify({
    user: user,
    request: 'initialize'
  }));

  ws.send(JSON.stringify({
    user: user,
    request: 'history'
  }));
}

ws.onmessage = (data) => {
  let msg = JSON.parse(data.data);
  if (msg.msgType == 'user_update') {
    parseChartDatum(msg);
  }

  if (msg.msgType == 'history') {
    console.log('History=====================')
    console.log(msg.response);
    parseHistory(msg.response);
  }


}

var chart = new Chartist.Line('.ct-chart', {
  series: series
}, {
  low: chartLow,
  high: chartHigh,
  showPoint: true,
  plugins: [
    Chartist.plugins.tooltip()
  ]
});

var parseChartDatum = function(row) {
  let bs = row.balances

  Object.keys(bs).forEach( (b) => {
    if (bs[b]['btcValue'] > 0 && keys.indexOf(b) === -1) {
      keys.push(b);
      series.push(Array(maxPoints));
    }
  });
  total['btcs'] = 0;
  try {
    rate = ((parseFloat(row['marketData']['USDT_BTC']['lowestAsk']) + parseFloat(row['marketData']['USDT_BTC']['highestBid'])) / 2);
  } catch (e) {
    console.log('No USDT rate available');
    rate = 0;
  }
  keys.forEach( (k) => {
    let bal = parseFloat(bs[k]['onOrders']) + parseFloat(bs[k]['available'])
    if (k == 'USDT') {
      bals[k] = bal / rate
    } else if (k == 'BTC') {
      bals[k] = bal
    } else {
      try {
        bals[k] = bal  * ((parseFloat(row['marketData']['BTC_' + k]['lowestAsk']) + parseFloat(row['marketData']['BTC_' + k]['highestBid'])) / 2);
      } catch (e) {
        console.log('No market data available for:', k);
        bals[k] = 0;
      }
    }
    total['btcs'] += bals[k];
  });
  total['usd'] = total['btcs'] * rate
}

var parseHistory = function(res) {
  keys = [];
  /* loop through each historical point */
  res.forEach( (row) => {
    parseChartDatum(row);
    /* loop through each coin in one point */
    keys.forEach( (k, i) => {
      if (series[i].length >= maxPoints) {
        series[i].shift();
      }
      series[i].push({
        meta: k,
        value: bals[k]
      });
    });
  });
}


var count = 0;
setInterval( () => {
  document.getElementById("total").innerHTML = "Total PL: $" + total['usd'];
  if (count >= 60) {
    keys.forEach( (k, i) => {
      if (series[i].length >= maxPoints) {
        series[i].shift();
      }
      series[i].push({
        meta: k,
        value: bals[k]
      });
    });
    count = 0;

  } else {
    keys.forEach( (k, i) => {
      series[i][series[i].length-1] = {
        meta: k,
        value: bals[k]
      };
    });
    count = count + 1;
  }
  chart.update({series})
}, 1000);
