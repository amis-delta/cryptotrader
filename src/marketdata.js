'use strict'

var EventEmitter = require('events').EventEmitter;


// Import poloniex push api module
var polo = require("poloniex-unofficial");


class MarketData extends EventEmitter {
  constructor() {
    super();

    this.poloPush = new polo.PushWrapper();
    this.marketData = {};
    this.coins = [];
    this.raw = [];

    this.poloPush.ticker( (err, res) => {
      if (err) {
        console.log('marketData:', err.msg);
      } else {
        if (this.coins.indexOf(res.currencyPair) === -1) {
          this.coins.push(res.currencyPair);
          this.raw.push(res.raw);
        } else {
          this.raw[this.coins.indexOf(res.currencyPair)] = res.raw;
        }
        this.marketData[res.currencyPair] = res;
        this.emit('ticker', res);
      }
    });

    setInterval(() => {
      this.poloPush = new polo.PushWrapper();
      console.log('New Push wrapper')
    }, 120000)
  }

}

module.exports = MarketData;
