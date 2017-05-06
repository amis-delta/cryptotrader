# -*- coding: utf-8 -*-
"""
Created on Thu Apr 27 13:38:40 2017

@author: jack
"""

import threading
import websocket
import time
import logging; logging.basicConfig(level=logging.DEBUG)


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
        self.pos = pd.DataFrame(columns=['balance', 'btcs', 'last'])


    def run(self):
        self.ws.run_forever()
        return

    def on_message(self, ws, message):
        self.msg = json.loads(message)
        fee = 1 - 0.00
        for coin, val in self.msg['balances'].iteritems():
            try:
                balance = (float(val['onOrders']) + float(val['available']))
                if (balance != 0):
                    if coin == 'USDT':
                        last = (float(self.msg['marketData']['USDT_BTC']['lowestAsk']) + float(self.msg['marketData']['USDT_BTC']['highestBid'])) / 2
                        self.pos.ix[coin] = [balance, (balance / last) * fee, last]
                    elif coin == 'BTC':
                        self.pos.ix[coin] = [balance, (balance) * fee, 0]
                    else:
                        last = (float(self.msg['marketData']['BTC_' + coin]['lowestAsk']) + float(self.msg['marketData']['BTC_' + coin]['highestBid'])) / 2
                        self.pos.ix[coin] = [balance, (balance * last) * fee, last]
            except:
                pass

        self.total = self.pos['btcs'].sum() * self.pos['last']['USDT']

    def on_error(self, ws, error):
        print error

    def on_close(self, ws):
        print "### closed ###"

    def on_open(self, ws):
        self.ws.send(self.user)
        print "connection opened"


r = receiver('ws://205.178.62.72:8888', 'jack')
r.start()