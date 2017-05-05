



class Pair {
  constructor(name, trades, poloPush) {
    console.log('Adding Pair:', name);

    this.name = name;
    this.poloPush = poloPush;

    poloPush.ticker( (err, res) => {
      if (err) {
        console.log(err.msg);
        return;
      }

      if (res.currencyPair == this.name) {
        this.pl = this.sellPrice - this.buyPrice  + (this.position * res.last);
        console.log(this.name, this.pl);
      }

    });

    this.base  = name.split('_')[0];
    this.quote = name.split('_')[1];

    this.position = 0;
    this.pl = 0;

    this.buyPrice = 0;
    this.sellPrice = 0;

    this.trades = trades || [];

    this.orders = {
      buys: {},
      sells: {}
    };
    this.parseTrades();
  }

  parseTrades() {

    this.trades.forEach( (val) => {
      // console.log(val)
      let net = (val.amount * (1 - val.fee))
      // console.log('net:', net);
      // console.log('netpl:', net * val.rate)
      if (val.type == 'buy') {
        this.position  += net;
        this.buyPrice  += net * val.rate;
      } else {
        this.position  -= val.amount;
        this.sellPrice += net * val.rate;
      }

    });

    // console.log(this.position)
    // console.log(this.buyPrice, this.sellPrice);
  }

}

module.exports = Pair
