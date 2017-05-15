var EventEmitter = require('events').EventEmitter;


// Import poloniex push api module
var polo = require("poloniex-unofficial");
var poloPush = new polo.PushWrapper(); // Get access to the push API


class MarketData extends EventEmitter {
  constructor() {
    super();

    this.marketData = {}
    this.coins = []
    this.raw = []

    poloPush.ticker( (err, res) => {
      if (this.coins.indexOf(res.currencyPair) === -1) {
        this.coins.push(res.currencyPair);
        this.raw.push(res.raw);
      } else {
        this.raw[this.coins.indexOf(res.currencyPair)] = res.raw;
      }
      this.marketData[res.currencyPair] = res;
      this.emit('ticker', res);
    });

  }
}

module.exports = MarketData;
