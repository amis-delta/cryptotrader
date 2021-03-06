# -*- coding: utf-8 -*-import poloniex
"""
Created on Thu Apr 27 13:38:40 2017

@author: jack
"""

import threading
import websocket
import time
import json
import logging; logging.basicConfig(level=logging.DEBUG)

import pandas as pd

class receiver(threading.Thread):

    def __init__(self, addr, user):
        threading.Thread.__init__(self)
        self.addr = addr
        self.user = user
        self.ws = websocket.create_connection(addr)
        self.ws = websocket.WebSocketApp(addr,
          on_message = self.on_message,
          on_error = self.on_error,
          on_close = self.on_close)

        self.ws.on_open = self.on_open
        self.balances = pd.DataFrame(columns=['balance', 'btc', 'last', 'orders'])
        self.pl = pd.DataFrame(columns=['pl', 'buyCount', 'sellCount', 'buyAmt', 'sellAmt', 'buyTotal', 'sellTotal', 'openAmt'])
        self.deposit = pd.DataFrame(columns=['pl', 'buyCount', 'sellCount', 'buyAmt', 'sellAmt', 'buyTotal', 'sellTotal', 'openAmt'])
        self.initObj = {'request': 'initialize', 'user': self.user}
        self.coinIdx = []
        self.btcusd = 0


    def run(self):
        self.ws.run_forever()
        return

    def on_message(self, ws, message):
#        print message
        self.msg = json.loads(message)
        
        self.coinIdx = []
        for pair in self.msg['marketData']:
            self.coinIdx.append(pair[0])
        
        
        fee = 1 - 0.00
        for coin, val in self.msg['balances'].iteritems():
            try:
                balance = (float(val['onOrders']) + float(val['available']))
                if (balance != 0):
                    if coin == 'USDT':
                        last = (float(self.msg['marketData'][self.coinIdx.index('USDT_BTC')][2]) + float(self.msg['marketData'][self.coinIdx.index('USDT_BTC')][3])) / 2
                        self.balances.loc[coin] = [balance, (balance / last) * fee, last, 0]
                        self.btcusd = last
                    elif coin == 'BTC':
                        orders = len(self.msg['orders']['USDT_BTC'])
                        self.balances.loc[coin] = [balance, (balance) * fee, 0, orders]
                    else:
                        last = (float(self.msg['marketData'][self.coinIdx.index('BTC_' + coin)][2]) + float(self.msg['marketData'][self.coinIdx.index('BTC_' + coin)][3])) / 2
                        orders = len(self.msg['orders']['BTC_' + coin])                        
                        self.balances.loc[coin] = [balance, (balance * last) * fee, last, orders]
            except:
                pass
        self.balances['usd'] = self.balances['btc'] * self.btcusd
        self.balances.sort_index(inplace=True)
        self.total = self.balances['btc'].sum() * self.balances['last']['USDT']
        self.balances['share'] = self.balances['usd'] / self.total
        
        for pair in self.msg['fills'].keys():
            row = [0,0,0,0,0,0,0,0]
            last = 0
            for t in self.msg['fills'][pair]:
                if t['type'] == 'buy':
                    row[1] += 1
                    row[3] += float(t['amount'])
                    row[5] += float(t['total'])
                elif t['type'] == 'sell':
                    row[2] += 1
                    row[4] += float(t['amount'])
                    row[6] += float(t['total'])
            try:
                last = float(self.msg['marketData'][self.coinIdx.index(pair)][2])
            except:
                pass
            row[7] = row[3] - row[4]
            row[0] = (row[6] - row[5]) + (row[7] * last)
            
            if pair[:3] == 'BTC' and pair != 'BTC_ZEC':
                self.pl.loc[pair] = row
            else:
                self.deposit.loc[pair] = row
                    
        self.pl.sort_values('pl', inplace=True)

    def on_error(self, ws, error):
        print error

    def on_close(self, ws):
        print "### closed ###"

    def on_open(self, ws):
        self.ws.send(json.dumps(self.initObj))
        print "connection opened"

