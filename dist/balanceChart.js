
var series = [];

var host = connInfo.websocket;
var port = connInfo.port;


var user = document.URL.split('/').pop();

var ws = new WebSocket('ws://' + host + ':' + port);

var bals = {btc: {}, usd: {}};
var marketdata = {};
var coinslist = [];
var balances = [];
var total = {};
var rate = 0;
var maxPoints = 12 * 60;

var balKeys = {
  coin: 0,
  usd: 1,
  btc: 2,
  portPct: 3,
  balance: 4,
  available: 5,
  onOrder: 6
}


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
  console.log('createChart');
  let yAxis;

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
    yAxis: balChartOptions[user] ? balChartOptions[user].yAxis : balChartOptions.default.yAxis,
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

  if (!row.balances) return;

  if (Object.keys(row.balances).length === 0) {
    console.log('empty timestamp... no balances to parse');
    return;
  }

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

  md['BTC_EMC2'] = {
    currencyPair: 'BTC_EMC2',
    last: '0.00002774',
    lowestAsk: '0.00002774',
    highestBid: '0.00002774',
    percentChange: '0',
    baseVolume: '0',
    quoteVolume: '0',
    isFrozen: '1'

  }
  md['BTC_EMC2']['24hrHigh'] = '0';
  md['BTC_EMC2']['24hrLow'] = '0';

  marketdata['BTC_EMC2'] = [
    "BTC_EMC2",
    "0.00002774",
    "0.00002774",
    "0.00002774",
    "0",
    "1922.47687677",
    "359690782.13199823",
    1,
    "0.00002774",
    "0.00002774"]


  /* loop through each coin in account balances */
  Object.keys(bs).forEach( (b) => {
    if (bs[b]['btcValue'] > 0 && coinslist.indexOf(b) === -1) {
      coinslist.push(b);
      balances.push(Array(Object.keys(balKeys).length));
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

  /* loop through each known coin and populate balances */
  coinslist.forEach( (k) => {
    let bal = 0;
    try {
      bal = parseFloat(bs[k]['onOrders']) + parseFloat(bs[k]['available']);
    } catch(e) {
      console.log('No balance for:', k)
    }
    if (k == 'USDT') {
      balances[coinslist.indexOf(k)][balKeys.coin] = k;
      balances[coinslist.indexOf(k)][balKeys.usd] = bal;
      balances[coinslist.indexOf(k)][balKeys.btc] = bal / rate;
      balances[coinslist.indexOf(k)][balKeys.balance] = bal;
      balances[coinslist.indexOf(k)][balKeys.available] = parseFloat(bs[k]['available']);
      balances[coinslist.indexOf(k)][balKeys.onOrder] = parseFloat(bs[k]['onOrders']);
      // bals.btc[k] = bal / rate;
      // bals.usd[k] = bal;
    } else if (k == 'BTC') {
      balances[coinslist.indexOf(k)][balKeys.coin] = k;
      balances[coinslist.indexOf(k)][balKeys.usd] = bal * rate;
      balances[coinslist.indexOf(k)][balKeys.btc] = bal;
      balances[coinslist.indexOf(k)][balKeys.balance] = bal;
      balances[coinslist.indexOf(k)][balKeys.available] = parseFloat(bs[k]['available']);
      balances[coinslist.indexOf(k)][balKeys.onOrder] = parseFloat(bs[k]['onOrders']);

      // bals.btc[k] = bal;
      // bals.usd[k] = bal * rate;
    } else {
      try {
        const last = ((parseFloat(md['BTC_' + k]['lowestAsk']) + parseFloat(md['BTC_' + k]['highestBid'])) / 2);
        balances[coinslist.indexOf(k)][balKeys.coin] = k;
        balances[coinslist.indexOf(k)][balKeys.btc] = bal * last;
        balances[coinslist.indexOf(k)][balKeys.usd] = balances[coinslist.indexOf(k)][balKeys.btc] * rate;
        balances[coinslist.indexOf(k)][balKeys.balance] = bal;
        balances[coinslist.indexOf(k)][balKeys.available] = parseFloat(bs[k]['available']);
        balances[coinslist.indexOf(k)][balKeys.onOrder] = parseFloat(bs[k]['onOrders']);

        // bals.btc[k] = bal  * ((parseFloat(md['BTC_' + k]['lowestAsk']) + parseFloat(md['BTC_' + k]['highestBid'])) / 2);
        // bals.usd[k] = bals.btc[k] * rate;
      } catch (e) {
        console.log('No market data available for:', k);
      }
    }
    total['btcs'] += balances[coinslist.indexOf(k)][balKeys.btc];
    total['usd'] += balances[coinslist.indexOf(k)][balKeys.usd];
  });

  /* calculate portfolio percentages */
  coinslist.forEach( (k) => {
    try {
      balances[coinslist.indexOf(k)][balKeys.portPct] = balances[coinslist.indexOf(k)][balKeys.usd] / total['usd'];
    } catch(e) {
      console.log('Not able to calculate pct for:', k);
    }
  });
}


var hist;
var parseHistory = function(res) {
  coinslist = [];
  /* loop through each historical point */
  res.forEach( (row) => {
    parseChartDatum(row, true);
    /* loop through each coin in one point */
    coinslist.forEach( (k, i) => {
      if (series[i].length >= maxPoints) {
        series[i].shift();
      }
      series[i].data.push({
        x: row.timestamp,
        y: balances[coinslist.indexOf(k)][balKeys.usd]
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
      coinslist.forEach( (k, i) => {
        const b = balances[i][balKeys.usd];
        myChart.series[i].addPoint({
          x: ts,
          y: b
        }, false, false, false);
      });

      count = 0;

    } else {
      coinslist.forEach( (k, i) => {
        const b = balances[i][balKeys.usd];
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
    dt.clear().rows.add(balances).draw();

  }, 5000);
}


var dt;
$(document).ready(function() {
    dt = $('#balanceTable').DataTable( {
        data: balances,
        columns: Object.keys(balKeys).map( (k) => ({
          title: k,
          render: $.fn.dataTable.render.number(',', '.', 8),
          className: 'dt-body-right'
        }))
    });
} );
