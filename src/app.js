const User = require('./user');
const MarketData = require('./marketdata');
const symbols = require('../data/symbols');

var userlist = require('../data/users');

var server = require('http').createServer();
var express = require('express');
var app = express();
var url = require('url');

var port = 8888;



app.use(express.static('../dist'));
server.on('request', app);
server.on('error', function(err) {
  console.log(err);
});
server.listen(port, function () {
  console.log('Listening on http://localhost:' + port);
});

const WebSocket = require('ws');
const wss = new WebSocket.Server({
  perMessageDeflate: false,
  server: server
});


var users = {};
var marketData = new MarketData();

var clients = {}

Object.keys(userlist).forEach( (u) => {
  users[u] = new User(userlist[u], marketData)
});


setInterval( () => {
  Object.keys(clients).forEach( (c) => {
    if (clients[c]['user']) {
      clients[c].ws.send(JSON.stringify(formatUserData(clients[c]['user'])));
    }
  });

}, 500)




wss.broadcast = function(data) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

wss.on('connection', function connection(ws) {
  console.log(Date(), ' - Websocket connected:', ws.upgradeReq.headers['sec-websocket-key']);

  clients[ws.upgradeReq.headers['sec-websocket-key']] = {
    ws: ws
  };

  ws.on('close', function() {
    console.log(Date(), ' - Websocket Disconnected:', ws.upgradeReq.headers['sec-websocket-key']);
    delete clients[ws.upgradeReq.headers['sec-websocket-key']];
    console.log(Object.keys(clients).length, 'clients connected');
  });


  ws.on('message', function incoming(data) {
    console.log(data);
    if(Object.keys(users).indexOf(data) > -1) {
      clients[ws.upgradeReq.headers['sec-websocket-key']]['user'] = data
    }
    // Broadcast to everyone else.
    wss.clients.forEach(function each(client) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        // client.send("HI!");
      }
    });
  });
});




var formatUserData = function(user) {
  let data = users[user];
  let strategies = {};
  Object.keys(data.strategies).forEach( (val) => {
    strategies[val] = data.strategies[val].data;
  });

  let res = {
    msgType:    'user',
    strategies: strategies,
    trades:     data.account.trades,
    balances:   data.account.balances,
    orders:     data.account.orders,
    marketData: marketData.data
  }
  return res;
}
