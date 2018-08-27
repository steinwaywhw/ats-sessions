#include "./runtime.h"
#include "./log.h"

#include <assert.h>
#include <stdio.h>
#include <execinfo.h>
#include <unistd.h>
#include <stdlib.h>
#include <stdint.h> /* INT32_MIN */
#include <string.h>
#include <pthread.h>
#include <signal.h>
#include <sys/time.h>

/**
 * Utilities.
 */

void step() {
	#ifndef NDEBUG
	puts("...\n");
	getchar();
	#endif
}

struct ep_t* g_endpoints[100];
atomic_int g_eindex = -1;
struct board_t* g_boards[100];
atomic_int g_bindex = -1;

void g_states() {
	log_set_level(LOG_TRACE);
	puts("Endpoint states\n");
	for (int i = 0; i <= g_eindex; i++) {
		if (g_endpoints[i] != NULL)
			ep_show(g_endpoints[i]);
	}
	puts("Board states\n");
	for (int i = 0; i <= g_bindex; i++) {
		if (g_boards[i] != NULL)
			board_show(g_boards[i]);
	}
}

void panic(const char* msg) {
	#define BT_BUF_SIZE 100
	fprintf(stderr, "\n[panic] %s\n", msg);

	void *buffer[BT_BUF_SIZE];

	int nptrs = backtrace(buffer, BT_BUF_SIZE);
	fprintf(stderr, "backtrace() returned %d addresses\n", nptrs);
	backtrace_symbols_fd(buffer, nptrs, STDERR_FILENO);

	g_states();

	exit(EXIT_FAILURE);
	#undef BT_BUF_SIZE
}

int32_t arr2bits(int n, int* arr) {
	int32_t ret = 0;
	while (n > 0) {
		ret |= (1 << *arr);
		n--; arr++;
	}
	return ret;
}

PRIVATE void _handle_sig(int s) {
	switch (s) {
	case SIGINT: panic("SIGINT"); break;
	case SIGSEGV: panic("SIGSEGV"); break;
	}
}

void install_handler() {
	struct sigaction h;
	h.sa_handler = _handle_sig;
	sigemptyset(&h.sa_mask);
	h.sa_flags = 0;
	sigaction(SIGINT, &h, NULL);
	sigaction(SIGSEGV, &h, NULL);
}


#include "./queue.c"
#include "./msg.c"
#include "./board.c"
#include "./ep.c"




