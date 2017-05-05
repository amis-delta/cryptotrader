var EventEmitter = require('events').EventEmitter;


// Import poloniex push api module
var polo = require("poloniex-unofficial");
var poloPush = new polo.PushWrapper(); // Get access to the push API


class MarketData extends EventEmitter {
  constructor() {
    super();

    this.data = {}

    poloPush.ticker( (err, res) => {
      this.data[res.currencyPair] = res;
      this.emit('ticker', res);
    });

  }
}

module.exports = MarketData;
