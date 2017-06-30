'use strict'

var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');

var polo = require("poloniex-unofficial");
var Portgamma = require('./strategies/portgamma');



class Account extends EventEmitter {
  constructor(user, marketData) {
    super();

    this.user = user;
    this.marketData = marketData;
    this.poloTrade = new polo.TradingWrapper(user['polKey'], user['polSecret']);

    this.lastUpdate = {
      fills: 1483228800, //initially start of 2017
      orders: 1483228800
    }


    this.data = {}
    this.data['fills'] = {};
    this.data['balances'] = {};
    this.data['orders'] = {};

    this.updated = {
      fills: false,
      orders: false
    }

    this.strategies = {}
    // this.strategies['port'] = new Portgamma(this.marketData, this.poloTrade, this);

  }

  updateBalances() {
    let endTime = Math.floor(new Date().getTime() / 1000);

    /* update account balances */
    this.poloTrade.returnCompleteBalances('all', (err, res) => {
      if (err) {
        console.log('balance request error:', err);
        return;
      }

      this.data.balances = res;

      this.emit('balances', res);
      this.lastUpdate.balances = endTime;
    });
    setTimeout(()=>{this.updateOrders()}, 2000);
  }

  updateOrders() {
    /* reset update flag */
    this.updated.orders = false;

    /* update open orders */
    this.poloTrade.returnOpenOrders('all', (err, res) => {

      if (err) {
        console.log('order   request error:', err);
        return;
      }


      if (!_.isEqual(this.data.orders, res)) {
        this.emit('order', res);
        this.data.orders = res;
        this.updated.orders = true;
        // this.strategies['port'].parseOrders(this.data.orders);
      }
      // this.strategies['port'].updateSellOrders();
      // this.strategies['port'].updateBuyOrders();
    });

    setTimeout(()=>{this.updateTrades()}, 2000)
  }

  updateTrades() {
    /* reset update flag */
    this.updated.fills = false;

    /* update trade history */
    let endTime = Math.floor(new Date().getTime() / 1000);

    this.poloTrade.returnTradeHistory('all', this.lastUpdate.fills, Math.floor(new Date().getTime() / 1000), (err, res) => {
      if (err) {
        console.log('trade   request error:', err);
        return;
      }

      if (!_.isEmpty(res)) {
        this.updated.fills = true;
        _.mergeWith(this.data.fills , res, (o,s) => {
          if (_.isArray(o)) {
            return o.concat(s);
          }
        });

        this.emit('fill', res);
        this.lastUpdate.fills = endTime;
        // this.strategies['port'].parseFills(res);
      }

      /* update strategies if new data */
      let newOrders = null;
      let newFills = null;

      if (this.updated.orders) {
        newOrders = this.data.orders;
      }

      if (this.updated.fills) {
        newFills = res;
      }

      // if (this.updated.orders || this.updated.fills) {
        // this.strategies['port'].parseUpdate(newOrders, newFills);
      // }
    });
  }

  startUpdating() {
    this.interval = setInterval( () => {
      this.updateBalances();
    }, 10000);
  }

}

module.exports = Account;
