'use strict'

require( "console-stamp" )( console, { pattern : "yyyy-mm-dd HH:MM:ss" } );

var _ = require('lodash');
var fs = require('fs');
var zlib = require('zlib');

const User = require('./user');
const MarketData = require('./marketdata');
const symbols = require('../data/symbols');

var userlist = require('../data/users');

var server = require('http').createServer();
var express = require('express');
var app = express();
var router = express.Router();
var url = require('url');
var path = require('path');



var port = 8888;

var processStartTime = new Date().getTime();
var minimumUpTime = processStartTime + (1000 * 60 * 3);


app.use(express.static('./../dist'));
app.use(express.static('./../node_modules/chartist-plugin-tooltips/dist'));
app.use('/highcharts/', express.static('./../node_modules/highcharts/'));

router.get('/monitor', (req, res) => {
    res.sendFile(path.join(__dirname + './../dist/price.html'));
});

router.get('/:user', (req, res) => {
  res.sendFile(path.join(__dirname + './../dist/balance.html'));
});

app.use('/', router);

server.on('request', app);
server.on('error', function(err) {
  console.log(err);
});
server.listen(port, function () {
  console.log('Listening on port:' + port);
});


var users = {};
var marketData = new MarketData();
var history = [];

try {
  zlib.unzip(fs.readFileSync('../data/history.log'), (err, buffer) => {
    if (!err) {
      history = JSON.parse(buffer.toString());
    }
  });
} catch(e) {
  console.log('no history file found');
}

var monitorClients = {};
var wsClients = {};

/* create users from file */
Object.keys(userlist).forEach( (u) => {
  users[u] = new User(userlist[u], marketData)
});
// users['jack'] = new User(userlist['jack'], marketData);


const WebSocket = require('ws');
const wss = new WebSocket.Server({
  perMessageDeflate: false,
  server: server
});

wss.broadcast = function(data) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

wss.on('connection', function connection(ws) {
  console.log('Websocket connected:', ws.upgradeReq.headers['sec-websocket-key']);



  ws.on('close', function() {
    console.log('Websocket Disconnected:', ws.upgradeReq.headers['sec-websocket-key']);
    delete wsClients[ws.upgradeReq.headers['sec-websocket-key']];
    console.log(Object.keys(wsClients).length, 'clients connected');
  });


  ws.on('message', function incoming(data) {
    console.log('Incoming msg: ', data);
    let msg;
    try {
      msg = JSON.parse(data);
    } catch(e) {
      console.log('Unparsable msg:', data)
    }

    /* map websocket request to existing client if possible */
    if (msg.request == 'initialize') {

      /* add balance client to client map */
      wsClients[ws.upgradeReq.headers['sec-websocket-key']] = {
        ws: ws,
        type: 'balance'
      };
      if(Object.keys(users).indexOf(msg.user) > -1) {
        wsClients[ws.upgradeReq.headers['sec-websocket-key']]['user'] = msg.user
      }

    /* send history when requested */
    } else if (msg.request == 'history') {
      let response;
      try {
        response = history.map( (row) => {
          return {
            timestamp: row.timestamp,
            marketData: row.marketData,
            balances: row.users[msg.user].balances
          };
        });

        ws.send(JSON.stringify({
          msgType: 'history',
          response: response
        }));
        console.log('History sent.');
      } catch(e) {
        console.log('History not sent');
      }

    } else if (msg.request == 'pricehistory') {

      wsClients[ws.upgradeReq.headers['sec-websocket-key']] = {
        ws: ws,
        type: 'monitor'
      }

      let response;
      try {
        response = history.map( (row) => {
          return {
            timestamp: row.timestamp,
            marketData: row.marketData
          }
        });

        ws.send(JSON.stringify({
          msgType: 'pricehistory',
          response: response
        }));

      } catch(e) {
        console.log('Price history not sent');
      }
    }
  });
});


/* send updates to connected websockets */
setInterval( () => {

  Object.keys(wsClients).forEach( (c) => {
    if (wsClients[c]['type'] == 'balance') {
      if (wsClients[c]['user']) {
        let res = formatUserData(wsClients[c]['user']);
        wsClients[c].ws.send(JSON.stringify(res));
      }
    } else if (wsClients[c]['type'] == 'monitor') {
        wsClients[c].ws.send(JSON.stringify(formatMonitorData()));
    }
  });
}, 5000);


/* record history */
setInterval( () => {
  let tempUsers = {}
  Object.keys(users).forEach( (u) => {
    tempUsers[u] = {
      balances: _.cloneDeep(users[u].account.data.balances)
    }
  });
  let row = {
    timestamp: new Date().getTime(),
    marketData: _.cloneDeep(marketData.raw),
    users: tempUsers
  }
  if (history.length > 60 * 12) {
    history.shift();
  }
  history.push(row);

  /* exit process if marketData has gone stale */
  let idx = history.length - 1;
  let curTime = new Date().getTime();
  if (_.isEqual(history[idx].marketData, history[idx-1].marketData)
    && _.isEqual(history[idx].marketData, history[idx-2].marketData)
    && curTime > minimumUpTime) {
        console.log('marketData is stale... exiting.');
        process.exit(0);
    }

  zlib.deflate(JSON.stringify(history), (err, buffer) => {
    if (!err) {
      fs.writeFile('../data/history.log', buffer, (er) => {
        if (er) { console.log(er) }
      });
    }
  });

}, 60000);


var formatUserData = function(user) {
  let data = users[user];
  let strategies = {};
  Object.keys(data.strategies).forEach( (val) => {
    strategies[val] = data.strategies[val].data;
  });

  let res = {
    timestamp: new Date().getTime(),
    msgType:    'user_update',
    strategies: strategies,
    trades:     data.account.data.trades,
    balances:   data.account.data.balances,
    orders:     data.account.data.orders,
    marketData: marketData.raw
  }
  return res;
}


var formatMonitorData = function() {
  let res = {
    msgType: 'price_update',
    timestamp: new Date().getTime(),
    marketData: marketData.raw
  }

  return res;
}
