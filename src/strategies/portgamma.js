'use strict'

var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var crypto = require('crypto');
var fs = require('fs');

var init = require('./portgamma_init');


var Pair = require('./../pair');

class Portgamma extends EventEmitter {
  constructor(marketData, poloTrade, account) {
    super();

    this.that = this;
    this.type = 'Portgamma';
    this.id = crypto.randomBytes(20).toString('hex');
    this.poloTrade = poloTrade;


    this.btcusd = 0;

    this.marketData = marketData;
    this.account = account;

    this.params = {
      step: .5,
      btcTarget: 0.0004,
      btcAdd: 0.0002,
      qty: 0.00010100,
      btcBuyThreshold: 0.00022
    }

    /* data is an object that contains all the relevant info for a pair */
    this.data = {}

    /* pairs is an array of pairnames from the set of fills  */
    this.pairs = [];

    /* order queue is full of orders that need to be sent */
    this.orderQueue = [];
    /* flag to show if current orders have been received and initialized */
    this.receivedOrders = false;
    /* flag to start queue management if not running */
    this.queueActive = false;
    /* bind callbacks */
    this.sendOrders = this.sendOrders.bind(this);
    this.orderResponseHandler = this.orderResponseHandler.bind(this);


    /* update pl with pricing data as it comes */
    this.marketData.on('ticker', (res) => {
      if(res.currencyPair== 'USDT_BTC') {
        this.btcusd = res.last;
      }
      // if(res.currencyPair == 'BTC_VRC' || res.currencyPair == 'BTC_GNT') {
        // console.log('md:', res)
      // }
      if (this.pairs.indexOf(res.currencyPair) > -1) {
        this.data[res.currencyPair].isLive = true;
        this.data[res.currencyPair].last = parseFloat(res.last);
        this.data[res.currencyPair].pl = (this.data[res.currencyPair].sellPrice - this.data[res.currencyPair].buyPrice + (this.data[res.currencyPair].position * this.data[res.currencyPair].last));
        this.data[res.currencyPair].btcs = this.data[res.currencyPair].position * this.data[res.currencyPair].last;
      }
    });
  }


  /* gets an array of pair names and initializes structures for new ones */
  addNewPairs(pairs) {
    let newPairs = pairs;
    console.log('newPairs length:', newPairs.length);
    /* don't add any where btc isn't base coin nor btc_zec*/
    newPairs.forEach((p) => {
      if (p.indexOf('BTC_') === -1 || p.indexOf('BTC_ZEC') > -1) {
        console.log('removing:', p, p.length);
        newPairs.splice(newPairs.indexOf(p),1);
      }
    });

    let i = 0;
    /* loop through all pairs in incoming list and add if absent */
    newPairs.forEach( (p)=> {
      console.log('newPair:', p);
      /* if pair doesn't exist add it to pairs and data objects */
      if (p.indexOf('BTC_') > -1 && this.pairs.indexOf(p) === -1) {
        console.log('added:', i, p);
        i = i + 1;
        this.pairs.push(p);
        this.data[p] = {
          name: p,
          base: p.split('_')[0],
          quote: p.split('_')[1],
          fills: [],
          orders: {
            buy: {},
            sell: {}
          },
          pendingOrders: {
            buy: [],
            sell: []
          },
          // ref: init[p].ref,
          // level: init[p].level,
          position: 0,
          pl: 0,
          btcs: 0,
          buyPrice: 0,
          sellPrice: 0,
          isLive: false,
          last: 0
        }
      }

    });
  }

  /* receives a list of open orders and parses them to the correct structure */
  parseOrders(orders) {

    /* loop through each pair in the orders object */
    Object.keys(orders).forEach((p) => {
      /* only parse if in the portfolio */
      if (this.pairs.indexOf(p) > -1) {
        /*loop through each order of each pair */
        orders[p].forEach( (o) =>{
          if (o.type === 'buy'){
            this.data[p].orders.buy[o['orderNumber']] = o;
          } else {
            this.data[p].orders.sell[o['orderNumber']] = o;
          }
        });
      }
    });
  }


  /* will receive an array of fills that occured since the last update */
  parseFills(fills) {

    /* loop through all pairs in recent fills */
    Object.keys(fills).forEach( (p)=> {
      /* parse new fills in this pair */
      if (this.data[p]) {
        fills[p].forEach( (fill) => {
          let fee = (1 - fill.fee);
          let net = (fill.amount * (1 - fill.fee));

          if (fill.type == 'buy') {
            this.data[p].position  += fill.amount * fee;
            this.data[p].buyPrice  += fill.amount * fill.rate;
          } else {
            this.data[p].position  -= fill.amount;
            this.data[p].sellPrice += fill.amount * fill.rate * fee;
          }
          this.data[p].position = parseFloat((this.data[p].position).toFixed(10));
          this.data[p].fills.push(fill);
        });

        /* traded pl */
        this.data[p].pl = (this.data[p].sellPrice - this.data[p].buyPrice);
      }
    });
  }

  parseUpdate(orders, fills) {

    let pairs = new Set();
    /* get instruments */
    if (orders) {
      Object.keys(orders).forEach((p)=> {
        pairs.add(p);
      });
      /* have received orders and can now send new ones */
      this.receivedOrders = true;
    }

    if (fills) {
      Object.keys(fills).forEach((p)=> {
        pairs.add(p);
      });
    }

    /* construct pairs if they don't already exist */
    this.addNewPairs(Array.from(pairs));

    /* parse orders and fills if exist */
    if(orders) this.parseOrders(orders);
    if(fills) this.parseFills(fills);

    /* update buys and sells if anything has changed and have received current orders */
    if (this.receivedOrders) {
      this.updateSellOrders();
      this.updateBuyOrders();
    }
  }


  /* will place a sell if none exists or
  modify existing orders if params change */
  updateSellOrders() {
    // console.log('updateSellOrders - queue length:', this.orderQueue.length);
    this.pairs.forEach( (p) => {
      if (this.data[p].isLive) {

        /* calculate sell price and amount */
        let exit = parseFloat((this.params.btcTarget / this.data[p].position).toFixed(8));
        let amt = parseFloat(((this.params.qty / exit)+0.00000001).toFixed(8));

        /* place order if doesn't exist or isn't pending
           and check if amt is large enough */
        if (Object.keys(this.data[p].orders.sell).length === 0
          && this.data[p].pendingOrders.sell.length === 0
          && amt >=  0.0000011) {
            console.log('create sell order');
          let order = {
            response: null,
            currencyPair: p,
            direction: 'sell',
            rate: exit,
            amount: amt,
            fillOrKill: 0,
            immediateOrCancel: 0
          }

          /* push onto pending array */
          this.data[p].pendingOrders.sell.push(order);

          if (order.currencyPair) {
            this.orderQueue.push(order);

            /* activate order queue if not already */
            if (!this.queueActive) {
              this.sendOrders();
            }
          }
        }
      }
    });
  }

  updateBuyOrders() {
    // console.log('updateBuyOrders - queue length:', this.orderQueue.length);
    this.pairs.forEach( (p) => {
      if (this.data[p].isLive) {
        let price = parseFloat((this.params.btcAdd / this.data[p].position).toFixed(8));
        let amt = parseFloat(((this.params.qty / price)+0.00000001).toFixed(8));

        /* place order if doesn't exist or isn't pending
           and check if amt is large enough */
        if (Object.keys(this.data[p].orders.buy).length === 0
          && this.data[p].pendingOrders.buy.length === 0
          && amt >= 0.0000011
          && this.data[p].btcs < this.params.btcBuyThreshold) {
            console.log('create buy order');
          let order = {
            response: null,
            currencyPair: p,
            direction: 'buy',
            rate: price,
            amount: amt,
            fillOrKill: 0,
            immediateOrCancel: 0
          }

          /* push onto pending array */
          this.data[p].pendingOrders.buy.push(order);

          if (order.currencyPair) {
            this.orderQueue.push(order);

            /* activate order queue if not already */
            if (!this.queueActive) {
              this.sendOrders();
            }
          }
        }
      }
    });

    // console.log(Object.keys(this.data).length);
    // fs.writeFileSync('orderqueue.json', JSON.stringify(this.orderQueue, null, 2));
    // fs.writeFileSync('portdata.json', JSON.stringify(this.data, null, 2));
    // fs.writeFileSync('pairs.json', JSON.stringify(this.pairs, null, 2));
  }


  sendOrders() {
    console.log('sendOrders queue length:', this.orderQueue.length);

    let order = this.orderQueue[0];

    this.queueActive = true;

    if (order.direction == 'buy') {
      console.log('sending buy:', order);
      this.poloTrade.buy(order.currencyPair, order.rate, order.amount, order.fillOrKill, order.immediateOrCancel, false, this.orderResponseHandler);
    } else if (order.direction == 'sell') {
      console.log('sending sell:', order);
      this.poloTrade.sell(order.currencyPair, order.rate, order.amount, order.fillOrKill, order.immediateOrCancel, false, this.orderResponseHandler);
    }

  }

  orderResponseHandler(err, response) {
    if (err) {
      let msg;
      try {
        msg = JSON.parse(err.msg);
      } catch (e) {
        msg = err.msg
      }

      console.log('orderResponseHandler:', msg);

      /* if amt is too small remove from queue and move on */
      if (msg.error === 'Amount must be at least 0.000001.'
        ||msg === 'Poloniex: Not enough BTC.') {
        this.orderQueue.shift();
      }

      if (this.orderQueue.length == 0) {
        console.log('order queue empty');
        this.queueActive = false;
        return;
      }
      setTimeout(this.sendOrders, 500);
      return;
    }

    console.log('order successful:', response);

    /* push successful order onto appropriate pending array for pair */
    this.data[this.orderQueue[0].currencyPair].pendingOrders[this.orderQueue[0].direction][0].response = response;
    /* pop successful order off queue */
    this.orderQueue.shift();

    if (this.orderQueue.length == 0) {
      console.log('order queue empty');
      this.queueActive = false;
      return;
    }
    setTimeout(this.sendOrders, 500);
  }

  /* loops through each pair and prints info */
  printOverview() {
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
  }

} //end class



module.exports = Portgamma;

var rpad = function(str, len) {
  return str + ' '.repeat(len - str.length);
}

var lpad = function(str, len) {
  return ' '.repeat(len - str.length) + str;
}
