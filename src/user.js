var _ = require('lodash');

var polo = require("poloniex-unofficial");
var Portgamma = require('./strategies/portgamma');
var Account = require('./account');

class User {
  constructor(user, marketData) {

    this.marketData = marketData
    this.poloTrade = new polo.TradingWrapper(user['polKey'], user['polSecret']);
    this.account = new Account(this.poloTrade);


    this.strategies = {};



    this.account.startUpdating();


    this.account.on('fill', (fills) => {

    });

    this.account.on('order', (order) => {

    })


    let start = 1483228800; //beginning 2017
    let end = new Date().getTime();
    // this.poloTrade.returnTradeHistory('all', start, end, (err, res) => {
    //   this.trades = res;
    //   this.strategies['port'] = new Portgamma(this.marketData, this.poloTrade, this.trades);
    // });


  }

}

module.exports = User;
