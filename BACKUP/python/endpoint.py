import uuid




class Endpoint(Object):

	def __init__(self, name, roles):
		self.id     = uuid.uuid4()
		self.roles  = roles
		self.name   = name
		self.peers  = dict()
		self.state  = 'init'

	def init(self):
		pass

	def broadcast(self, payload):
		pass 

	def receive(self):
		pass 

	def close(self):
		pass 

	def wait(self):
		pass 

	@staticmethod
	def link(ep1, ep2):
		pass
