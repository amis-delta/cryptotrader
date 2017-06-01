'use strict'

var EventEmitter = require('events').EventEmitter;


// Import poloniex push api module
var polo = require("poloniex-unofficial");


class MarketData extends EventEmitter {
  constructor() {
    super();

    this.poloPush = new polo.PushWrapper();

    this.marketData = {}
    this.coins = []
    this.raw = []

    this.poloPush.ticker( (err, res) => {
      if (this.coins.indexOf(res.currencyPair) === -1) {
        this.coins.push(res.currencyPair);
        this.raw.push(res.raw);
      } else {
        this.raw[this.coins.indexOf(res.currencyPair)] = res.raw;
      }
      this.marketData[res.currencyPair] = res;
      this.emit('ticker', res);
    });

    setInterval(() => {
      this.poloPush = new polo.PushWrapper();
      console.log('New Push wrapper')
    }, 120000)
  }

  // get poloPush() {
  //   return this.poloPush;
  // }
  //
  // set poloPush(canReset) {
  //   if (canReset) {
  //     this.poloPush = new polo.PushWrapper();
  //   }
  // }
}

module.exports = MarketData;
