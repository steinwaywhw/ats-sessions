/**
 * Endpoints. Please #include this file in runtime.c
 */

struct ep_t* ep_make(int32_t full, int32_t self, struct board_t* board) {
	struct ep_t* ep = (struct ep_t*)malloc(sizeof(struct ep_t));
	ep->self = self;
	ep->full = full;
	ep->board = board_ref(board);

	g_endpoints[++g_eindex] = ep;
	return ep;
}

void ep_free(struct ep_t* ep) {
	board_free(ep->board);
	free(ep);

	for (int i = 0; i <= g_eindex; i++) {
		if (g_endpoints[i] == ep)
			g_endpoints[i] = NULL;
	}
	return;
}

struct ep_t* ep_split(struct ep_t* ep, int32_t split) {
	assert(MSG_SET_SUP(ep->self, split));

	ep->self = MSG_SET_MINUS(ep->self, split);
	struct ep_t* ret = ep_make(ep->full, split, board_ref(ep->board));
	return ret;
}

void ep_send(struct ep_t* ep, int label, int32_t from, int32_t to, void* payload) {
	struct msg_t* m       = msg_make(label, from, to, payload);
	struct board_t* child = board_write(ep->board, m);
	
	if (child != ep->board) {
		struct board_t* old = ep->board;
		ep->board = board_ref(child);
		board_free(old);
	}

	return;
}

void* ep_recv(struct ep_t* ep, int label, int32_t from, int32_t to) {
	struct msg_t* p       = msg_make(label, from, to, NULL);
	struct msg_t* found   = msg_make(-1, INT32_MIN, INT32_MIN, NULL);

	struct board_t* child = board_read(ep->board, p, found);	
	assert(found->label == p->label);

	if (child != ep->board) {
		struct board_t* old = ep->board;
		ep->board = board_ref(child);
		board_free(old);
	} 
	
	// The pointer is copied. The actual content is not owned by the message.
	// This is only possible in shared memory.
	void* payload = found->payload;
	msg_free(p);
	msg_free(found);

	if (label == MSG_SYNC_CLOSE) {
		log_trace("SYNC_CLOSE Received!");
	}
	
	// switch (label) {
	// case MSG_MSG:
	// 	log_info("MSG %s read from %s", payload, ep->board->id);
	// 	break;
	// }

	return payload;
}

void ep_sync(struct ep_t* ep, int label, int syncer) {
	int32_t senders = MSG_SET_MINUS(ep->full, ep->self);
	
	char buffer[100];
	int i = 0;
	while (senders > 0) {
		for(unsigned int mask = 0x80; mask; mask >>= 1) {
			i += sprintf(buffer+i, "%d", !!(mask & senders));    	
		}
		log_trace("Syncing with %s", buffer);
		int32_t sender = (int32_t)(ep_recv(ep, label, INT32_MIN, syncer));
		senders = MSG_SET_MINUS(senders, sender);
		i = 0;
	}
	return;
}


/**
 * Link two endpoints. The operation puts the reference of each one into the other.
 *
 * When reading:
 * - If KILL, jump to the other board and read again. 
 * 	 - If KILL is the only message, return the new board.
 * 	 - Otherwise, keep using the old board.
 * - If KEEP, 
 *   - If the KEEP is sent by oneself (self < KEEP.senders, or !(self < KEEP.receivers)), skip.
 *   - Otherwise, jump to the other board and read again.
 *   	- If succeed, return.
 *   	- If failed, restart search from the next one.
 *   		- If the other board only contains the KILL, remove KEEP.
 *
 * When writing:
 * - If KILL, jump to the other board and write again.
 * 	 - If KILL is the only message, return the new board.
 * 	 - Otherwise, keep using the old board.
 * - If KEEP, skip.
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

	// Keep ep1->board.
	// FWD_KEEP:
	//   senders:   full - ep2.self  
	//   receivers: ep2.self
	struct msg_t* q = msg_make(MSG_FWD_KEEP, ep2->full & ~ep2->self, ep2->self, board_ref(ep2->board));
	
	// Kill ep2. 
	ep1->self &= ep2->self;

	board_write(ep2->board, p);
	board_write(ep1->board, q);


	ep_free(ep2);

	return ep1;
}

void ep_show(struct ep_t* ep) {
	char buffer[100];
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