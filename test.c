

#include <stdio.h>
#include <assert.h>
#include <string.h>
#include <unistd.h>
#include <stdlib.h>
#include <execinfo.h>

#include <nng/nng.h>
#include <nng/protocol/pubsub0/sub.h>
#include <nng/protocol/pubsub0/pub.h>
#include <nng/supplemental/util/platform.h>

#include <pthread.h>

#define ADDRESS "inproc://topic"

void panic(const char* msg) {
	fprintf(stderr, "[panic] %s\n", msg);

	#define BT_BUF_SIZE 100
	void *buffer[BT_BUF_SIZE];

	int nptrs = backtrace(buffer, BT_BUF_SIZE);
	fprintf(stderr, "backtrace() returned %d addresses\n", nptrs);
	backtrace_symbols_fd(buffer, nptrs, STDERR_FILENO);

	exit(EXIT_FAILURE);
}

void* pub(void* data) {
	nng_socket pub;
	nng_msg*   msg;

	assert(0 == nng_pub_open(&pub));
	assert(0 == nng_dial(pub, ADDRESS, NULL, 0));
	nng_msleep(200);

	assert(0 == nng_msg_alloc(&msg, 0));
	assert(0 == nng_msg_append(msg, ADDRESS, strlen(ADDRESS)));
	assert(0 == nng_msg_append(msg, &data, sizeof(&data)));
	assert(nng_msg_len(msg) == sizeof(&data) + strlen(ADDRESS));

	printf("PUBLISH: %s\n", nng_msg_body(msg));
	assert(0 == nng_sendmsg(pub, msg, 0));
	nng_msleep(200);

	nng_close(pub);

	return NULL;
}

void* sub() {
	nng_socket sub;
	nng_msg*   msg;

	assert(0 == nng_sub_open(&sub));
	assert(0 == nng_listen(sub, ADDRESS, NULL, 0));
	assert(0 == nng_setopt(sub, NNG_OPT_SUB_SUBSCRIBE, ADDRESS, strlen(ADDRESS)));

	while (1) {
		assert(0 == nng_recvmsg(sub, &msg, 0));
		assert(nng_msg_len(msg) == sizeof(void*) + strlen(ADDRESS));
		nng_msleep(200);

		if (NNG_EINVAL == nng_msg_trim(msg, strlen(ADDRESS)))
			panic("EINVAL");

		const char* data = *(char**)nng_msg_body(msg);
		printf("RECEIVED: %s\n", data);

		nng_msg_free(msg);
		if (strcmp(data, "CLOSE") == 0) break;
	}
	
	nng_close(sub);
	return NULL;
}


int main(int argc, char** argv) {
	pthread_t s, p1, p2, p3;
	pthread_create(&s, 0, sub, NULL);

	nng_msleep(1000);
	pthread_create(&p1, 0, pub, "pub1");
	pthread_create(&p2, 0, pub, "pub2");

	nng_msleep(1000);
	pthread_create(&p3, 0, pub, "CLOSE");

	pthread_join(s, 0);
	pthread_join(p1, 0);
	pthread_join(p2, 0);
	pthread_join(p3, 0);

	exit(EXIT_SUCCESS);
}