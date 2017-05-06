var series = [];

var host = '205.178.62.72';
var ws = new WebSocket('ws://' + host + ':8888');

var bals = {};
var keys = [];
var total = {};
var rate = 0

ws.onopen = () => {
  ws.send('jack')
}

ws.onmessage = (msg) => {
  let data = JSON.parse(msg.data)
  let bs = data.balances
  Object.keys(bs).forEach( (b) => {
    if (bs[b]['btcValue'] > 0 && keys.indexOf(b) === -1) {
      keys.push(b);
      series.push([0]);
    }
  });
  total['btcs'] = 0;
  keys.forEach( (k) => {
    let bal = parseFloat(bs[k]['onOrders']) + parseFloat(bs[k]['available'])
    if (k == 'USDT') {
      rate = ((parseFloat(data['marketData']['USDT_BTC']['lowestAsk']) + parseFloat(data['marketData']['USDT_BTC']['highestBid'])) / 2);
      bals[k] = bal / rate
    } else if (k == 'BTC') {
      bals[k] = bal
    } else {
      bals[k] = bal  * ((parseFloat(data['marketData']['BTC_' + k]['lowestAsk']) + parseFloat(data['marketData']['BTC_' + k]['highestBid'])) / 2);
    }
    // console.log(k, bals[k])
    total['btcs'] += bals[k];
  });
  total['usd'] = total['btcs'] * rate
  }

var chart = new Chartist.Line('.ct-chart', {
  series: series
}, {
  low: 0,
  high: .0003,
  showPoint: true,
  plugins: [
    Chartist.plugins.tooltip()
  ]
});

var count = 0;
var maxPoints = 60 * 24;
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
