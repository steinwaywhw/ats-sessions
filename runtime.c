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

/**
 * Utilities.
 */

void step() {
	#ifndef NDEBUG
	puts("...\n");
	getchar();
	#endif
}

// pthread_mutex_t btlock = PTHREAD_MUTEX_INITIALIZER;

void panic(const char* msg) {
	// pthread_mutex_lock(&btlock);
	fprintf(stderr, "\n[panic] %s\n", msg);

	#define BT_BUF_SIZE 100
	void *buffer[BT_BUF_SIZE];

	int nptrs = backtrace(buffer, BT_BUF_SIZE);
	fprintf(stderr, "backtrace() returned %d addresses\n", nptrs);
	backtrace_symbols_fd(buffer, nptrs, STDERR_FILENO);

	// pthread_mutex_unlock(&btlock);
	exit(EXIT_FAILURE);
}

int32_t arr2bits(int n, int* arr) {
	int32_t ret = 0;
	while (n > 0) {
		ret |= (1 << *arr);
		n--; arr++;
	}
	return ret;
}

#include <signal.h>
PRIVATE void _handle_sig(int s) {
	panic("Ctrl+C");
}

void install_handler() {
	struct sigaction h;
	h.sa_handler = _handle_sig;
	sigemptyset(&h.sa_mask);
	h.sa_flags = 0;
	sigaction(SIGINT, &h, NULL);
	sigaction(SIGSEGV, &h, NULL);
}


/**
 * Simple queue.
 */

struct queue_t* queue_make() {
	struct queue_t* q = (struct queue_t*)malloc(sizeof(struct queue_t));
	q->head = NULL;
	q->tail = NULL;
	return q;
}

int queue_free(struct queue_t* q) {
	int i = 0;
	while (q->head != NULL) {
		i++;
		void* e = queue_deq(q);
		if (e != NULL) free(e);
	}
	log_debug("Queue @ %p freed.", (void*)q);
	free(q);
	return i;
}

void queue_enq(struct queue_t* q, void* payload) {
	struct queue_node_t* node = (struct queue_node_t*)malloc(sizeof(struct queue_node_t));
	node->payload = payload;
	node->next = NULL;

	/* empty queue */
	if (q->head == NULL) {
		q->head = node;
		q->tail = node;
		return;
	}

	q->tail->next = node;
	q->tail = node;
}

void* queue_deq(struct queue_t* q) {
	/* empty queue */
	if (q->head == NULL) panic("Empty queue.");

	/* one element */
	if (q->head == q->tail) {
		void* ret = q->head->payload;
		free(q->head);
		q->head = NULL;
		q->tail = NULL;

		return ret;
	}

	/* more elements */
	void* ret = q->head->payload;
	struct queue_node_t* newhead = q->head->next;
	free(q->head);
	q->head = newhead;

	return ret;
}

void* queue_ideq(struct queue_t* q, int i) {
	if (i == 0) return queue_deq(q);

	struct queue_node_t* cur = q->head;
	while (cur != NULL && i > 1) {
		cur = cur->next;
		i--;
	}
	if (cur == NULL || cur->next == NULL) panic("Index out of range.");	
	assert(i == 1);

	struct queue_node_t* tofree = cur->next;
	void* payload = tofree->payload;
	cur->next = tofree->next;
	if (cur->next == NULL) q->tail = cur;

	free(tofree);
	return payload;
}

void* queue_iget(struct queue_t* q, int i) {
	struct queue_node_t* cur = q->head;
	while (cur != NULL && i > 0) {
		cur = cur->next;
		i--;
	}
	if (cur == NULL) panic("Index out of range.");	
	return cur->payload;
}

void queue_iforeach(struct queue_t* q, queue_fn f, void* env) {
	struct queue_node_t* cur = q->head;
	int i = 0;
	while (cur != NULL) {
		f(i, cur->payload, env);
		i++;
		cur = cur->next;
	}
}

int queue_find (struct queue_t* q, void* addr) {
	struct queue_node_t* cur = q->head;
	int i = 0;
	while (cur != NULL && cur->payload != addr) {
		cur = cur->next;
		i++;
	}

	return cur != NULL ? i : -1;
}


/**
 * Messages.
 */

void msg_show(struct msg_t* m) {
	char* label;
	switch (m->label) {
	case MSG_MSG        : label = "MSG";           break;
	case MSG_FWD_KEEP   : label = "KEEP";          break;
	case MSG_FWD_KILL   : label = "KILL";          break;
	case MSG_BRANCH     : label = "BRANCH";        break;
	case MSG_SYNC_INIT  : label = "SYNC_INIT";     break;
	case MSG_SYNC_CLOSE : label = "SYNC_CLOSE";    break;
	case MSG_CLOSE      : label = "CLOSE";         break;
	case MSG_INIT       : label = "INIT";          break;
	default             : panic("Unknown label.");
	}

	char buffer[100];
	int i = sprintf(buffer, "\t[%s] [", label);
	for(unsigned int mask = 0x80; mask; mask >>= 1) {
		i += sprintf(buffer+i, "%d", !!(mask & m->senders));
	}
	i += sprintf(buffer+i, "] [");	
	for(unsigned int mask = 0x80; mask; mask >>= 1) {
		i += sprintf(buffer+i, "%d", !!(mask & m->receivers));    	
	} 
	const char* disp = m->label == MSG_FWD_KEEP || m->label == MSG_FWD_KILL ? ((struct board_t*)m->payload)->id : m->payload;
	if (disp == NULL) disp = "(null)";
	// sprintf(buffer+i, "] [%s]", disp);	
	i += sprintf(buffer+i, "]");
	if (m->label == MSG_SYNC_INIT || m->label == MSG_SYNC_CLOSE) {
		i += sprintf(buffer+i, " [");
		for(unsigned int mask = 0x80; mask; mask >>= 1) {
			i += sprintf(buffer+i, "%d", !!(mask & (int32_t)m->payload));    	
		} 
		sprintf(buffer+i, "]");
	}
	log_debug("%s", buffer);
}

struct msg_t* msg_make(int label, int32_t senders, int32_t receivers, void* payload) {
	struct msg_t* m = (struct msg_t*)malloc(sizeof(struct msg_t));
	m->label = label;
	m->senders = senders;
	m->receivers = receivers;
	m->payload = payload;
	return m;
}

void msg_free(struct msg_t* msg) {
	log_debug("Message @ %p freed.", (void*)msg);
	free(msg);
}


/**
 * Blackboard.
 */

struct board_t* board_make(const char* id) {
	struct board_t* b = (struct board_t*)malloc(sizeof(struct board_t));
	pthread_mutex_init(&b->mutex, NULL);
	pthread_cond_init(&b->cond, NULL);
	b->queue = queue_make();
	strcpy(b->id, id);
	b->refcount = 1;
	return b;
}

struct board_t* board_ref(struct board_t* b) {
	// board_lock(b);
	b->refcount++;
	// log_info("Board %s @ %p inc ref to %d.", b->id, (void*)b, b->refcount);
	// board_unlock(b);
	return b;
}

int board_free(struct board_t* b) {
	// board_lock(b);
	b->refcount--;
	assert(b->refcount >= 0);

	if (b->refcount > 0) {
		// log_info("Board %s @ %p dec ref to %d.", b->id, (void*)b, b->refcount);
		// board_unlock(b);
		return -1;
	}

	assert(b->refcount == 0);
	// board_unlock(b);
	board_show(b);
	pthread_mutex_destroy(&b->mutex);
	pthread_cond_destroy(&b->cond);

	int i = 0;
	while (b->queue->head != NULL) {
		i++;
		struct msg_t* e = (struct msg_t*)queue_deq(b->queue);
		assert(e != NULL);

		struct board_t* child;
		switch (e->label) {
		case MSG_FWD_KILL:
		case MSG_FWD_KEEP:
			child = (struct board_t*)e->payload;
			board_free(child);
		}
		free(e);
		// if (e != NULL) free(e);
	}

	int count = queue_free(b->queue);
	log_info("Board %s @ %p freed with %d message(s).", b->id, (void*)b, i);
	free(b);
	return i;
}

void board_lock (struct board_t* board) {
	pthread_mutex_lock(&board->mutex);
	// log_warn("Board @ %p locked.", (void*)board);
}

void board_unlock (struct board_t* board) {
	pthread_mutex_unlock(&board->mutex);
	// log_warn("Board @ %p unlocked.", (void*)board);
}


PRIVATE struct search_env_t {
	int index; // index of -1
	struct msg_t* pattern;
	struct msg_t* found;
};

PRIVATE void search(int i, struct msg_t* m , struct search_env_t* env) {
	#define SETENV(_index, _found) {env->index=_index; env->found=_found;}

	// Already found, skip. 
	if (env->index >= 0) return;

	// FWD_KEEP, set as found. 
	if (m->label == MSG_FWD_KEEP) {
		if (MSG_SET_SUB(env->pattern->receivers, m->receivers)) {
			SETENV(i, m);
			return;
		} else {
			return;
		}
	}

	// FWD_KILL, set as found.
	if (m->label == MSG_FWD_KILL) {
		SETENV(i, m);
		return;
	}
 
	if (env->pattern->label >= 0 && env->pattern->label != m->label) return;

	if (env->pattern->senders != INT32_MIN 
		&& !MSG_SET_SUB(env->pattern->senders, m->senders)) return;

	if (env->pattern->receivers != INT32_MIN 
		&& !MSG_SET_SUB(env->pattern->receivers, m->receivers)
		&& !MSG_SET_SUP(env->pattern->receivers, m->receivers)) return;

	SETENV(i, m);
	return;

	#undef SETENV
}

/**
 * Write to the blackboard. Write always succeeds. 
 * 
 * @param  b 	The board to write to.
 * @param  m 	The message.
 * @return   	The board where the endpoint should be writing to/reading from.
 */
struct board_t* board_write(struct board_t* b, struct msg_t* m) {
	
	board_lock(b);

	if (b->queue->head == NULL || ((struct msg_t*)(b->queue->tail->payload))->label != MSG_FWD_KILL) {
		log_debug("Written to %p", (void*)b);
		queue_enq(b->queue, m);
		// board_show(b);
		// step();
		pthread_cond_broadcast(&b->cond);
		board_unlock(b);

		// Write succeeds. Should continue to use the board.
		return b;
	}

	// Check the tail.	
	struct msg_t* last = (struct msg_t*)b->queue->tail->payload;
	assert(last->label == MSG_FWD_KILL);


	// Find if there is any message that should be received by m->senders.
	// struct msg_t* pattern = msg_make(-1, INT32_MIN, m->senders, NULL);
	// struct search_env_t env = {.index=-1, .pattern=pattern, .found=NULL};
	// int relevant = 1;
	// if (env.index < 0 || env.found.label == MSG_FWD_KILL || env.found.label == MSG_FWD_KEEP) relevant = 0

	// If this is a fully marked last message, free the board.
	// if (last->receivers == 0 && b->queue->head == b->queue->tail) {
		// log_debug("Board should be killed %s.", b->id);
		// last = queue_deq(b->queue);
		// board_unlock(b);
		// return last;
	// } 

	board_unlock(b);

	struct board_t* child = (struct board_t*)last->payload;
	log_info("Saw KILL in %s. Writing again to %s %p", b->id, child->id, (void*)child);
	board_show(b);
	struct board_t* grandchild = board_write(child, m);

	board_lock(b);

	// If KILL is the only message left.
	if (b->queue->head == b->queue->tail) {
		assert(last->label == MSG_FWD_KILL);

		// The `b` board should be freed, and the endpoint needs to use the new board. 
		pthread_cond_broadcast(&b->cond);
		board_unlock(b);
		return grandchild;
	}

	// Otherwise, continue to use `b`.
	pthread_cond_broadcast(&b->cond);
	board_unlock(b);
	return b;
}




/**
 * Read from the board. The function only returns in the following situation. 
 *   1. It found a match. 
 *   2. The board has no more information fore the caller. Should be changed.
 *
 * @param  b       The board to read from.
 * @param  pattern Message pattern. 
 * @param  out     The found message. 
 * @return         The actual board read from.
 */
struct board_t* board_read(struct board_t* b, struct msg_t* pattern, struct msg_t* out) {
	board_lock(b);

	// Wait until the next matched message.
	struct search_env_t env = {.index = -1, .pattern = pattern, .found = NULL};
	queue_iforeach(b->queue, (queue_fn)search, (void*)&env);
	while (env.index < 0) {
		// log_debug("Try reading from %p", b->id);
		pthread_cond_wait(&b->cond, &b->mutex);
		queue_iforeach(b->queue, (queue_fn)search, (void*)&env);
	}

	// log_info("Reading from %s %p", b->id, (void*)b);
	struct msg_t   *found = env.found;
	struct board_t *grandchild, *child;

	// Need to check for FWD messages.
	switch (found->label) {
	
	case MSG_FWD_KEEP: 
		child = (struct board_t*)found->payload;
		assert(MSG_SET_SUB(pattern->receivers, found->receivers));

		board_unlock(b);

		// Jump.
		// log_debug("Jumping from %s to %s.", b->id, child->id);
		// struct msg_t* childfound = board_read(child, pattern);
		log_info("Saw KEEP in %s. Reading again from %s %p", b->id, child->id, (void*)child);
		grandchild = board_read(child, pattern, out);

		// Found the message. FWD_KEEP untouched. 
		// if (childfound->label == pattern->label) return childfound; 
	
		// DO I NEED TO LOCK HERE? 
		

		if (out->label == pattern->label) {
			// if (grandchild != child) {
			// 	board_free(child);
			// 	found->payload = board_ref(grandchild);
			// }
			log_debug("Read success from KEEP in %s.", b->id);
			//board_unlock(b);
			return b;
		}

		board_lock(b);
		// Must be aborted. Mark.
		// board_lock(b);
		// assert(childfound->label == MSG_FWD_KILL);

		// If all bits are marked, delete FWD_KEEP.
		// if (found->receivers == 0) {
		// 	int index = queue_find(b->queue, found);
		// 	assert(index >= 0);
		// 	found = queue_ideq(b->queue, index);
		// 	free(found);
		// }
		// 
		// 

		// If someone else has freed the KEEP, just return.
		int index = queue_find(b->queue, found);
		if (index < 0) {
			log_info("Someone else deleted KEEP.");
			board_unlock(b);
			return board_read(b, pattern, out);
		}

		// Otherwise.

		found->receivers = MSG_SET_MINUS(found->receivers, pattern->receivers);
		
		// If the child board has only a KILL message, 
		// then delete the KEEP message, and release the board.
		if (child->queue->head == child->queue->tail) {
			board_free(child);
			found = queue_ideq(b->queue, index);
			log_info("KEEP %p @ %s deleted.", (void*)found, b->id);
			free(found);				
		}

		log_info("Read failed from KEEP in %s", b->id);
		board_unlock(b);

		// Need to redo the read.
		return board_read(b, pattern, out);

	// Our board is being killed.
	case MSG_FWD_KILL:

		// Mark.
		// found->receivers = MSG_SET_MINUS(found->receivers, pattern->receivers);

		// If all marked, delete the board but keep the message.
		// if (found->receivers == 0) {
			// found = queue_ideq(b->queue, env.index);
			// board_unlock(b);
			// assert(0 == board_free(b));
		// }

		// Failed to find any message. Abort.
		// This case is only for readings initiated via a JUMP from KEEP messages.
		if (MSG_SET_SUB(pattern->receivers, found->senders)) {
			log_info("Saw KILL in %s. Read failed.", b->id);
			// return found;
			board_unlock(b);

			// board_show(b);
			return b;
		}
			
		// Otherwise, let the caller jump. 
		// log_debug("Should jump from %s to %s.", b->id, ((struct board_t*)(found->payload))->id);
		board_unlock(b);
		// return found;
		child = (struct board_t*)(found->payload);
		log_info("Saw KILL in %s. Read again from %s %p", b->id, child->id, (void*)child);
		return board_read(child, pattern, out);

	default:
		// log_debug("Found in %s.", b->id);
		
		// Mark and copy the payload (which is a pointer).
		found->receivers = MSG_SET_MINUS(found->receivers, pattern->receivers);
		memcpy(out, found, sizeof(struct msg_t));

		// struct msg_t* ret = msg_make(found->label, INT32_MIN, INT32_MIN, found->payload);

		// If all received, delete the message.
		if (found->receivers == 0) free(queue_ideq(b->queue, env.index));

		// board_show(b);
		
		board_unlock(b);
		// return ret;
		log_info("Read success in %s %p", b->id, (void*)b);
		return b;
	}

	return NULL;
}



// struct msg_t* board_read(struct board_t* b, struct msg_t* pattern) {
// 	board_lock(b);

// 	// Wait until the next matched message.
// 	struct search_env_t env = {.index = -1, .pattern = pattern, .found = NULL};
// 	queue_iforeach(b->queue, (queue_fn)search, (void*)&env);
// 	while (env.index < 0) {
// 		log_debug("Try reading from %s ...", b->id);
// 		pthread_cond_wait(&b->cond, &b->mutex);
// 		queue_iforeach(b->queue, (queue_fn)search, (void*)&env);
// 	}

// 	log_debug("Reading from %s.", b->id);
// 	struct msg_t*   found = env.found;
// 	struct board_t* child;

// 	// Need to check for FWD messages.
// 	switch (found->label) {
	
// 	case MSG_FWD_KEEP: 
// 		child = (struct board_t*)found->payload;
// 		assert(MSG_SET_SUB(pattern->receivers, found->receivers));

// 		board_unlock(b);

// 		// Jump.
// 		log_debug("Jumping from %s to %s.", b->id, child->id);
// 		struct msg_t* childfound = board_read(child, pattern);

// 		// Found the message. FWD_KEEP untouched. 
// 		if (childfound->label == pattern->label) return childfound;

// 		// Must be aborted. Mark.
// 		board_lock(b);
// 		assert(childfound->label == MSG_FWD_KILL);
// 		found->receivers = MSG_SET_MINUS(found->receivers, pattern->receivers);

// 		// If all bits are marked, delete FWD_KEEP.
// 		if (found->receivers == 0) {
// 			int index = queue_find(b->queue, found);
// 			assert(index >= 0);
// 			found = queue_ideq(b->queue, index);
// 			free(found);
// 		}
// 		board_unlock(b);

// 		// Need to redo the read.
// 		return board_read(b, pattern);

// 	// Our board is being killed.
// 	case MSG_FWD_KILL:

// 		// Mark.
// 		found->receivers = MSG_SET_MINUS(found->receivers, pattern->receivers);

// 		// If all marked, delete the board but keep the message.
// 		if (found->receivers == 0) {
// 			found = queue_ideq(b->queue, env.index);
// 			board_unlock(b);
// 			// assert(0 == board_free(b));
// 		}

// 		// Failed to find any message. Abort.
// 		if (MSG_SET_SUB(pattern->receivers, found->senders)) {
// 			log_debug("No message found in %s. Abort.", b->id);
// 			return found;
// 		}
			
// 		// Otherwise, let the caller jump. 
// 		log_debug("Should jump from %s to %s.", b->id, ((struct board_t*)(found->payload))->id);
// 		board_unlock(b);
// 		return found;

// 	default:
// 		log_debug("Found in %s.", b->id);
// 		// Mark.
// 		found->receivers = MSG_SET_MINUS(found->receivers, pattern->receivers);
// 		struct msg_t* ret = msg_make(found->label, INT32_MIN, INT32_MIN, found->payload);

// 		// If all received, delete the message.
// 		if (found->receivers == 0) free(queue_ideq(b->queue, env.index));

// 		board_show(b);
// 		board_unlock(b);

// 		return ret;
// 	}

// 	return NULL;
// }

PRIVATE void board_dbgfn(int i, struct msg_t* m, void* env) {
	log_debug("  %s => ", env);
	msg_show(m);
}

void board_show(struct board_t* b) {
	board_lock(b);
	log_debug("Board %s %p ref %d", b->id, (void*)b, b->refcount);
	queue_iforeach(b->queue, (queue_fn)board_dbgfn, b->id);
	board_unlock(b);
}

// PRIVATE void* board_testfn_w(void** args) {
// 	struct board_t* b = args[0];
// 	struct msg_t* m = args[1];

// 	board_write(b, m);

// 	return NULL;
// }

// PRIVATE void* board_testfn_r(void** args) {
// 	struct board_t* b = args[0];
// 	struct msg_t* m = args[1];

// 	board_read(b, m);

// 	return NULL;
// }

// void board_test() {
// 	struct board_t* b = board_make();

// 	pthread_t w1, w2, r1, r2, r3, r4;

// 	struct msg_t* msg;

// 	struct msg_t* m1 = msg_make(MSG_MSG  , arr2bits(1,(int[1]){0}) , arr2bits(2,(int[2]){1,2}) , "0 -> 1,2");
// 	struct msg_t* m2 = msg_make(MSG_LEFT , arr2bits(1,(int[1]){1}) , arr2bits(2,(int[2]){0,2}) , "1 -> 0,2");
// 	struct msg_t* p1 = msg_make(MSG_MSG  , arr2bits(1,(int[1]){0}) , arr2bits(1,(int[1]){1})   , NULL);
// 	struct msg_t* p2 = msg_make(-1       , arr2bits(1,(int[1]){0}) , arr2bits(1,(int[1]){2})   , NULL);
// 	struct msg_t* p3 = msg_make(MSG_LEFT , arr2bits(1,(int[1]){1}) , arr2bits(1,(int[1]){2})   , NULL);
// 	struct msg_t* p4 = msg_make(-1       , arr2bits(1,(int[1]){1}) , arr2bits(1,(int[1]){0})   , NULL);

// 	pthread_create(&w1, 0, (void*(*)(void*))board_testfn_w, (void*[2]){b, m1});
// 	pthread_create(&w2, 0, (void*(*)(void*))board_testfn_w, (void*[2]){b, m2});

// 	// sleep(1);
// 	pthread_create(&r1, 0, (void*(*)(void*))board_testfn_r, (void*[2]){b, p1});
// 	pthread_create(&r2, 0, (void*(*)(void*))board_testfn_r, (void*[2]){b, p2});
// 	pthread_create(&r3, 0, (void*(*)(void*))board_testfn_r, (void*[2]){b, p3});
// 	pthread_create(&r4, 0, (void*(*)(void*))board_testfn_r, (void*[2]){b, p4});

// 	pthread_join(w1, 0);
// 	pthread_join(w2, 0);
// 	pthread_join(r1, 0);
// 	pthread_join(r2, 0);	
// 	pthread_join(r3, 0);
// 	pthread_join(r4, 0);

// 	// sleep(1);
// 	board_free(b);
// }


struct ep_t* ep_make(int32_t full, int32_t self, struct board_t* board) {
	struct ep_t* ep = (struct ep_t*)malloc(sizeof(struct ep_t));
	ep->self = self;
	ep->full = full;
	ep->board = board_ref(board);
	return ep;
}

void ep_free(struct ep_t* ep) {
	board_free(ep->board);
	free(ep);
	return;
}

void ep_send(struct ep_t* ep, int label, int32_t to, void* payload) {
	// `m` will be owned by the board.
	struct msg_t* m = msg_make(label, ep->self, to, payload);

	// msg_show(m);
	// `last` is read-only. It is still owned by the board.
	struct board_t* child = board_write(ep->board, m);
	
	// If the board has changed.
	if (child != ep->board) {
		board_free(ep->board);
		ep->board = board_ref(child);
	}

	// while (last != ep->board) {
		// assert(last->label == MSG_FWD_KILL);
		// board_free(ep->board);
		// ep->board = board_ref(last->payload);
		// ep_show(ep);
		// last = board_write(ep->board, m);
	// }
	// board_show(ep->board);
	return;
}

void* ep_recv(struct ep_t* ep, int label, int32_t from) {
	// `p` is owned by the endpoint.
	struct msg_t* p = msg_make(label, from, ep->self, NULL);
	// `found` will be owned by the endpoint.
	// struct msg_t* found = board_read(ep->board, p);
	struct msg_t* found = msg_make(-1, INT32_MIN, INT32_MIN, NULL);
	struct board_t* child = board_read(ep->board, p, found);

	// ep_show(ep);
	// Read until it is actually found.
	// while (found->label != label) {
	// 	struct board_t* child = (struct board_t*)found->payload;
	// 	assert(found->label == MSG_FWD_KILL);
	// 	board_free(ep->board);
	// 	ep->board = board_ref(child);
	// 	ep_show(ep);
	// 	found = board_read(ep->board, p);
	// }
	
	assert(found->label == p->label);
	if (child != ep->board) {
		board_free(ep->board);
		ep->board = board_ref(child);
	} 
	

	// The pointer is copied. The actual content is not owned by the message.
	// This is only possible in shared memory.
	void* payload = found->payload;
	
	board_show(ep->board);
	free(p);
	free(found);
	return payload;
}

void ep_sync(struct ep_t* ep, int label) {
	int32_t senders = MSG_SET_MINUS(ep->full, ep->self);
	for(unsigned int mask = 0x8000; mask; mask >>= 1) {
		int cur = mask & senders;
		if (cur > 0) {
			int32_t sender = (int32_t)(ep_recv(ep, label, cur));
			senders = MSG_SET_MINUS(senders, sender);
		}
	} 

	return;
}


/**
 * Link two endpoints. 
 *
 * Jump rules: 
 * 	1. If (new roles < senders), skip.
 * 	2. If FWD_KILL and (new roles < full - senders), jump. Otherwise, mark and abort.
 * 	3. If FWD_KEEP and (new roles < full - senders) and (new roles < unmarked receivers), jump.
 * 	
 * Mark rules: 
 *  1. Mark with new roles.
 *  2. Commit or abort after mark.
 *  3. If fully marked, free KILL board, or free KEEP message.
 *
 * Commit rules:
 *  1. If FWD_KILL, change board.
 *  2. If FWD_KEEP, nothing. Indicates no jump because of mark. 
 *
 * Abort rules:
 *  1. If FWD_KILL, return to caller.
 *  2. If FWD_KEEP, no such case.
 *
 * Read rules:
 *  1. If FWD_KILL, (mark, return, caller jump) || (mark, abort)
 *  2. If FWD_KEEP, (jump, return) || (jump, abort, mark, return) || (skip)
 *
 * Write rules: 
 *  1. If FWD_KILL, (return, caller jump).
 *  2. If FWD_KEEP, (skip).
 * 
 * Invariants: 
 * 	1. FWD_KILL must be the last message of any board.
 * 	2. Receiver bits in FWD_KILL can only be marked once, since they've committed/aborted.
 * 	3. Marked receiver bits in FWD_KEEP means the other board becomes irrelevant to this bit. 
 * 
 * @param  ep1 The keep endpoint.
 * @param  ep2 The kill endpoint.
 * @return     The keep endpoint.
 */
struct ep_t* ep_link(struct ep_t* ep1, struct ep_t* ep2) {

	// Kill ep2->board. 
	// FWD_KILL: 
	//   senders:   ep2.self
	//   receivers: ep2.full
	struct msg_t* p = msg_make(MSG_FWD_KILL, ep2->self, ep2->full, board_ref(ep1->board));
	board_write(ep2->board, p);

	// Keep ep1->board.
	// FWD_KEEP:
	//   senders:   full - ep2.self  
	//   receivers: ep2.self
	p = msg_make(MSG_FWD_KEEP, ep2->full & ~ep2->self, ep2->self, board_ref(ep2->board));
	board_write(ep1->board, p);

	// Kill ep2. 
	ep1->self &= ep2->self;

	ep_free(ep2);

	return ep1;
}

void ep_show(struct ep_t* ep) {
	char buffer[64];
	int i = sprintf(buffer, "Endpoint [");
	for(unsigned int mask = 0x80; mask; mask >>= 1) {
		i += sprintf(buffer+i, "%d", !!(mask & ep->full));    	
	}
	i += sprintf(buffer+i, "] [");
	for(unsigned int mask = 0x80; mask; mask >>= 1) {
		i += sprintf(buffer+i, "%d", !!(mask & ep->self));    	
	}
	sprintf(buffer+i, "] [%s] @ %p", ep->board->id, (void*)ep);
	log_debug(buffer);
}

PRIVATE void* ep0(void* arg) {
	struct ep_t* ep = (struct ep_t*)arg;
	ep_send(ep, MSG_MSG, PACK(1), "hello");
	ep_send(ep, MSG_MSG, PACK(1), "world");
	log_info("0 Received: %s", ep_recv(ep, MSG_MSG, PACK(1)));

	ep_free(ep);
	return NULL;
}

PRIVATE void* ep1(void* arg) {
	struct ep_t* ep = (struct ep_t*)arg;
	log_info("1 Received %s", ep_recv(ep, MSG_MSG, PACK(0)));
	log_info("1 Received %s", ep_recv(ep, MSG_MSG, PACK(0)));
	ep_send(ep, MSG_MSG, PACK(0), "!");

	ep_free(ep);	
	return NULL;
}

PRIVATE void* ep01(void* arg) {
	struct ep_t** eps = (struct ep_t**)arg;
	log_info("Linking ...");
	struct ep_t* ep = ep_link(eps[0], eps[1]);
	assert(ep->self == 0);
	ep_free(ep);
	return NULL;
}

void ep_test() {
	struct board_t* bds[] = {board_make("A"), board_make("B")};
	struct ep_t* eps[] = {ep_make(PACK(0,1), PACK(0), bds[0]), 
	                      ep_make(PACK(0,1), PACK(1), bds[0]),
	                      ep_make(PACK(0,1), PACK(0), bds[1]),
	                      ep_make(PACK(0,1), PACK(1), bds[1])};

    pthread_t tids[4];
    pthread_create(&tids[0], 0, ep0, eps[0]);
    pthread_create(&tids[1], 0, ep1, eps[1]);
    pthread_create(&tids[2], 0, ep0, eps[2]);
    pthread_create(&tids[3], 0, ep1, eps[3]);


    for (int i = 0; i < 4; i++) {
    	pthread_join(tids[i], 0);
    }

    for (int i = 0; i < 2; i++) {
    	board_free(bds[i]);
    }
}

void ep_test_link() {
	struct board_t* bds[] = {board_make("A"), board_make("B")};
	struct ep_t* eps[] = {ep_make(PACK(0,1), PACK(0), bds[0]), 
	                      ep_make(PACK(0,1), PACK(1), bds[0]),
	                      ep_make(PACK(0,1), PACK(0), bds[1]),
	                      ep_make(PACK(0,1), PACK(1), bds[1])};

    pthread_t tids[3];
    pthread_create(&tids[0], 0, ep0, eps[0]);
    sleep(1);
    pthread_create(&tids[1], 0, ep1, eps[3]);
    sleep(1);

    pthread_create(&tids[2], 0, ep01, eps+1);
    sleep(1);


    for (int i = 0; i < 3; i++) {
    	pthread_join(tids[i], 0);
    }


    // board_show(bds[0]);
    // board_show(bds[1]);

    // log_info("RESULT: %s %d", bds[0]->id, board_free(bds[0]));
    // log_info("RESULT: %s %d", bds[1]->id, board_free(bds[1]));

    // for (int i = 0; i < 2; i++) {
    // 	board_free(bds[i]);
    // }
}

// int main(int argc, char** argv) {
// 	install_handler();
// 	log_set_pthread();
// 	log_set_level(LOG_INFO);
// 	ep_test_link();
// }