


class Transport(Object):

	def __init___(self, sid):
		self.state = 'init'
		pass

	def connect(self, addr):
		pass 

	def disconnect(self, addr):
		pass 

	def send(self, json):
		pass 

	def receive(self, seq):
		pass 

import nanomsg

class NanomsgTransport(Transport):

	def __init__(self, sid):
		pass

	def connect(self, addr):
		if self.state != 'init':
			return



	def broker(self, addr):
		if self.broker is not None:
			return self.broker

		self.broker = nanomsg.Socket(nanomsg.PAIR)



# class NanomsgTransportBroker(Transport):
	


# import redis 

# class RedisTransport(Transport):

# 	def __init__(self):
# 		super().__init__(self)
# 		self.redis  = None
# 		self.lounge = 'lounge' # keyspace for sessions waiting to start
# 		self.sid    = None	   # keyspace for the current session

# 	def connect(self, addr):
# 		host, port, sid = addr

# 		self.sid   = sid
# 		self.redis = redis.StrictRedis(host=host, port=port)

# 		return self


# 	def send(self, json)
# 		return self.redis.rpush(self.sid, json)

# 	def receive(self, seq)
# 		resp = self.redis.lindex(self.sid, seq)
# 		if resp is None:
# 			self.redis.brpop(self.sid)

# 	def control(self, json)
