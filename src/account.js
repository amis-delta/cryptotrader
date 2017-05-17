var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');

var polo = require("poloniex-unofficial");



class Account extends EventEmitter {
  constructor(user) {
    super();

    this.user = user;
    this.poloTrade = new polo.TradingWrapper(user['polKey'], user['polSecret']);
    this.CONNTIMEOUT = false;

    this.lastUpdate = {
      fills: 1483228800, //initially start of 2017
      orders: 1483228800
    }

    this.data = {}
    this.data['fills'] = {};
    this.data['balances'] = {};
    this.data['orders'] = {};


  }

  update() {

    let endTime = Math.floor(new Date().getTime() / 1000);

    /* update account balances */
    this.poloTrade.returnCompleteBalances('all', (err, res) => {
      if (err) {
        console.log('balance request error:', err);
        if (err['msg'].indexOf('Connection timed out') > -1) {
          this.CONNTIMEOUT = true;
        }
        return;
      }

      this.data.balances = res;

      this.emit('balances', res);
      this.lastUpdate.balances = endTime;

    });



    setTimeout(() => {
      let endTime = Math.floor(new Date().getTime() / 1000);

      this.poloTrade.returnOpenOrders('all', (err, res) => {
        if (err) {
          console.log('order request error:', err);
          if (err['msg'].indexOf('Connection timed out') > -1) {
            this.CONNTIMEOUT = true;
          }
          return;
        }


        if (!_.isEqual(this.data.orders, res)) {
          this.emit('order', res);
          this.data.orders = res;
        }
      });
    }, 1000);

    setTimeout(() => {
      let endTime = Math.floor(new Date().getTime() / 1000);

      this.poloTrade.returnTradeHistory('all', this.lastUpdate.fills, Math.floor(new Date().getTime() / 1000), (err, res) => {
        if (err) {
          console.log('trade request error:', err);
          if (err['msg'].indexOf('Connection timed out') > -1) {
            this.CONNTIMEOUT = true;
          }
          return;
        }

        if (!_.isEmpty(res)) {

          _.mergeWith(this.data.fills , res, (o,s) => {
            if (_.isArray(o)) {
              return o.concat(s);
            }
          });

          this.emit('fill', res);
          this.lastUpdate.fills = endTime;
        }
      });

      if (this.CONNTIMEOUT) {
        console.log('Reconnecting...');
        this.poloTrade = new polo.TradingWrapper(this.user['polKey'], this.user['polSecret']);
        this.CONNTIMEOUT = false
      }
    }, 2000);


  }

  startUpdating() {
    this.interval = setInterval( () => {
      this.update();

    }, 10000);

  }

}

module.exports = Account;
