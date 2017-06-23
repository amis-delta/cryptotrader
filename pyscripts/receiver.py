# -*- coding: utf-8 -*-
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
        self.pos = pd.DataFrame(columns=['balance', 'btcs', 'last', 'orders'])
        self.initObj = {'request': 'initialize', 'user': self.user}
        self.coinIdx = []


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
                        self.pos.ix[coin] = [balance, (balance / last) * fee, last, 0]
                    elif coin == 'BTC':
                        orders = len(self.msg['orders']['USDT_BTC'])
                        self.pos.ix[coin] = [balance, (balance) * fee, 0, orders]
                    else:
                        last = (float(self.msg['marketData'][self.coinIdx.index('BTC_' + coin)][2]) + float(self.msg['marketData'][self.coinIdx.index('BTC_' + coin)][3])) / 2
                        orders = len(self.msg['orders']['BTC_' + coin])                        
                        self.pos.ix[coin] = [balance, (balance * last) * fee, last, orders]
            except:
                pass
        self.pos.sort_index(inplace=True)
        self.total = self.pos['btcs'].sum() * self.pos['last']['USDT']

    def on_error(self, ws, error):
        print error

    def on_close(self, ws):
        print "### closed ###"

    def on_open(self, ws):
        self.ws.send(json.dumps(self.initObj))
        print "connection opened"

