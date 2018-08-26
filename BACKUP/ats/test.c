#include <stdio.h>
#include <assert.h>
#include <string.h>
#include <nng/nng.h>
#include <nng/protocol/bus0/bus.h>
#include <nng/supplemental/util/platform.h>
#include <stdlib.h>

void work(void* arg) {
	nng_aio* aio = *(nng_aio**)arg;
	int ret = nng_aio_result(aio);

	if (ret != 0) {
		printf("Error: %s\n", nng_strerror(ret));
		return;
	}

	nng_msg* msg = nng_aio_get_msg(aio);
	printf("Server received: %s\n", nng_msg_body(msg));
	nng_msg_free(msg);

	// this is a defered free
	nng_aio_free(aio);
}


int server(const char* url) {

	nng_socket sock;
	int ret;

	assert(nng_bus0_open(&sock) == 0);

	nng_aio* aio;
	assert(nng_aio_alloc(&aio, work, &aio) == 0);

	assert(nng_listen(sock, url, NULL, 0) == 0);
	printf("Server connected\n");

	nng_recv_aio(sock, aio);
	nng_aio_wait(aio);
	// assert(nng_aio_result(aio) == 0);
	// nng_msg* msg = nng_aio_get_msg(aio);

	// printf("Server received: %s", nng_msg_body(msg));
	// nng_msg_free(msg);

	// nng_aio_free(aio);
	
	// char* msg; 
	// size_t size;

	// nng_recv(sock, &msg, &size, NNG_FLAG_ALLOC);
	// printf("Message received: %s\n", msg);
	// free(msg);

	nng_close(sock);
	return 0;
}

int client(const char* url) {
	nng_socket sock;
	int ret;

	assert(nng_bus0_open(&sock) == 0);
	assert(nng_dial(sock, url, NULL, 0) == 0);
	printf("Client connected\n");

	char* data = "hello";
	printf("Client sent: %s\n", data);
	nng_send(sock, data, strlen(data), 0);

	nng_msleep(1000);
	nng_close(sock);
	return 0;
}

int main(int argc, char** argv) {
	assert(argc == 3);

	switch (argv[1][0]) {
		case 'c': client(argv[2]); break;
		case 's': server(argv[2]); break;
	}

	return 0;
}