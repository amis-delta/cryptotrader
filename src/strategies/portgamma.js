var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var crypto = require("crypto");



var Pair = require('./../pair');

class Portgamma extends EventEmitter {
  constructor(marketData, poloTrade, fills) {
    super();
    this.type = 'Portgamma';
    this.id = crypto.randomBytes(20).toString('hex');

    this.btcusd = 0;

    this.marketData = marketData;

    this.params = {
      step: .5,
      btcTarget: 0.0002

    }

    /* setup object for pair data */
    this.data = {}
    this.pairs = Object.keys(fills);
    this.pairs.splice(this.pairs.indexOf('USDT_BTC'),1);
    // this.pairs.splice(this.pairs.indexOf('BTC_ZEC'),1);

    // this.pairs = this.pairs.splice(this.pairs.indexOf('BTC_NMC'),1);

    this.pairs.forEach( (p) => {
      this.data[p] = {
        name: p,
        base: p.split('-')[0],
        quote: p.split('-')[1],
        fills: [],
        orders: {
          buys: [],
          sells: []
        },
        position: 0,
        pl: 0,
        buyPrice: 0,
        sellPrice: 0,
        isLive: false,
        last: 0
      }

      /* parse fills for each pair */
      fills[p].forEach( (fill) => {
        let fee = (1 - fill.fee);
        let net = (fill.amount * (1 - fill.fee));
        // console.log(fill);


        if (fill.type == 'buy') {
          this.data[p].position  += fill.amount * fee;
          this.data[p].buyPrice  += fill.amount * fill.rate;

          // console.log('net:', fill.amount * fee);
          // console.log('netpl:', fill.amount * fill.rate);
        } else {
          this.data[p].position  -= fill.amount;
          this.data[p].sellPrice += fill.amount * fill.rate * fee;

          // console.log('net:', fill.amount);
          // console.log('netpl:', fill.amount * fill.rate * fee);
        }
        // console.log();

      });
      // console.log('pos', this.data[p].position)

      /* traded pl */
      this.data[p].pl = (this.data[p].sellPrice - this.data[p].buyPrice);
    });

    /* update pl with pricing data as it comes */
    this.marketData.on('ticker', (res) => {
      if(res.currencyPair== 'USDT_BTC') {
        this.btcusd = res.last;
      }
      if (this.pairs.indexOf(res.currencyPair) > -1) {
        let pair = this.data[res.currencyPair];
        pair.isLive = true;
        pair.last = parseFloat(res.last);
        pair.pl = (pair.sellPrice - pair.buyPrice + (pair.position * pair.last));
      }
    });


    setInterval( () => {
      let total = 0;
      let count = 0;
      this.pairs.forEach( (p) => {
        if (this.data[p].position == 0 || this.data[p].isLive) {
          console.log(
            rpad(p, 10),
            lpad(this.data[p].pl.toFixed(8), 11),
            lpad(this.data[p].position.toFixed(8), 13),
            lpad(this.data[p].last.toFixed(8), 11)
          );
          // console.log(this.data[p].buyPrice, this.data[p].sellPrice)
          total += this.data[p].pl;
          count += 1;
        }
      });

      console.log();
      console.log(new Date().toUTCString());
      console.log('Pairs:', count, '/', this.pairs.length);
      console.log('TOTAL:', rpad(total.toFixed(8),13));
      console.log();

    }, 500);

  }


}

var calcTargetPrice = function(target, pair) {
  return   parseFloat((target / pair.position).toFixed(8));
}

module.exports = Portgamma;

var rpad = function(str, len) {
  return str + ' '.repeat(len - str.length);
}

var lpad = function(str, len) {
  return ' '.repeat(len - str.length) + str;
}
