import nanomsg
import concurrent.futures 
import time 

addr = 'ipc:///tmp/bus.ipc'

bus = nanomsg.Socket(nanomsg.BUS, domain=nanomsg.AF_SP_RAW)
# print(bus.bind(addr))

def device_loop(bus):
	device = nanomsg.Device(bus)	
	print(device.start())
	return 

s1 = nanomsg.Socket(nanomsg.PAIR)
print(s1.bind(addr))

def s1_loop(s1):
	while True:
		print('s1 sending ...')
		print(s1.send(b's1 sent a message'))
		time.sleep(1)
		# print(s1.recv())

s2 = nanomsg.Socket(nanomsg.PAIR)
print(s2.connect(addr))

def s2_loop(s2):
	while True:
		print('s2 receiving ...')
		# s2.send(b's2 sent a message')
		print(s2.recv())


with concurrent.futures.ProcessPoolExecutor(max_workers=10) as pool:
	# bus_future = pool.submit(device_loop, bus)
	s1_future  = pool.submit(s1_loop, s1)
	s2_future  = pool.submit(s2_loop, s2)

	for future in concurrent.futures.as_completed([s1_future, s2_future]):
		try:
			print(future.result())
		except Exception as e:
			print(e)


