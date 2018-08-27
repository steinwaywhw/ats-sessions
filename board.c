/**
 * Blackboard. Please #include this file in runtime.c
 */

struct board_t* board_make(const char* id) {
	struct board_t* b = (struct board_t*)malloc(sizeof(struct board_t));
	pthread_mutex_init(&b->mutex, NULL);
	pthread_cond_init(&b->cond, NULL);
	b->queue = queue_make();
	strcpy(b->id, id);
	b->refcount = 1;

	log_info("Board %s @ %p allocated.", b->id, b);
	// Debug
	g_boards[++g_bindex] = b;
	return b;
}

struct board_t* board_ref(struct board_t* b) {
	b->refcount++;
	return b;
}

int board_free(struct board_t* b) {
	b->refcount--;
	assert(b->refcount >= 0);

	if (b->refcount > 0) return -1;
	assert(b->refcount == 0);

	board_show(b);
	pthread_mutex_destroy(&b->mutex);
	pthread_cond_destroy(&b->cond);

	int i = 0;
	while (b->queue->head != NULL) {
		struct msg_t* e = (struct msg_t*)queue_deq(b->queue);
		assert(e != NULL);
		msg_free(e);
		i++;
	}

	int count = queue_free(b->queue);
	assert(count == 0);

	log_info("Board %s @ %p freed with %d message(s).", b->id, (void*)b, i);

	for (int i = 0; i <= g_bindex; i++) {
		if (g_boards[i] == b) g_boards[i] = NULL;
	}

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
	struct msg_t* from;  // default to NULL
	struct msg_t* pattern;
	struct msg_t* found;
};

PRIVATE void search(int i, struct msg_t* cur , struct search_env_t* env) {
	#define SETENV(_index, _found) {env->index=_index; env->found=_found;}

	// Already found, skip. 
	if (env->index >= 0) return;

	if (env->from != NULL) {
		// Not yet the starting point.
		if (cur != env->from) {
			return;
		}

		// Start from the next.
		env->from = NULL;
		return;
	}

	if (cur->label == MSG_FWD_KEEP) {
		// FWD_KEEP, set as found. 
		if (MSG_RECVER_MATCH(cur, env->pattern)) SETENV(i, cur);
		
		// Skip
		return;
	}

	// FWD_KILL, set as found.
	if (cur->label == MSG_FWD_KILL) {
		SETENV(i, cur);
		return;
	}
 
	if (MSG_MATCH(cur, env->pattern)) {
		SETENV(i, cur);

		#ifndef NDEBUG
			char buffer[100];
			int j = sprintf(buffer, "Searching for %s ", msg_show_label(env->pattern));
			j += msg_show_senders(env->pattern, buffer+j);
			j += sprintf(buffer+j, " => ");
			j += msg_show_receivers(env->pattern, buffer+j);
			log_trace("%s Found! From = %p, index = %d, cur = %d", buffer, env->from, env->index, i);
		#endif
	}

	#ifndef NDEBUG
		char buffer[100];
		int j = sprintf(buffer, "Searching for %s ", msg_show_label(env->pattern));
		j += msg_show_senders(env->pattern, buffer+j);
		j += sprintf(buffer+j, " => ");
		j += msg_show_receivers(env->pattern, buffer+j);
		log_trace("%s FAILED! From = %p, index = %d, cur = %d", buffer, env->from, env->index, i);
	#endif

	return;

	#undef SETENV
}

/**
 * Write to the blackboard. Write always succeeds, and no matter where the message
 * actually goes, we always signal.
 * 
 * @param  b 	The board to write to.
 * @param  m 	The message.
 * @return   	The board where the endpoint should be writing to/reading from.
 */
struct board_t* board_write(struct board_t* b, struct msg_t* m) {
	
	board_lock(b);

	if (b->queue->head == NULL || ((struct msg_t*)(b->queue->tail->payload))->label != MSG_FWD_KILL) {
		queue_enq(b->queue, m);
		msg_log(b, m, 1);
		pthread_cond_broadcast(&b->cond);
		board_unlock(b);

		// Write succeeds. Should continue to use the board.
		return b;
	}

	// Check the tail.	
	struct msg_t* last = (struct msg_t*)b->queue->tail->payload;
	assert(last->label == MSG_FWD_KILL);

	board_unlock(b);

	struct board_t* child = (struct board_t*)last->payload;
	log_trace("Saw KILL in %s. Writing again to %s", b->id, child->id);
	struct board_t* grandchild = board_write(child, m);

	board_lock(b);
	assert(b->queue->head != NULL);

	// If KILL is the only message left.
	if (b->queue->head == b->queue->tail) {
		assert(last->label == MSG_FWD_KILL);
		log_trace("KILL is the last message in %s.", b->id);

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
 * Read from the board. 
 *
 * @param  b       The board to read from.
 * @param  pattern Message pattern. 
 * @param  out     The found message. 
 * @return         The actual board read from.
 */
struct board_t* board_read(struct board_t* b, struct msg_t* pattern, struct msg_t* out) {

	/* 	Keep looping, until we find the match.
	   	
	   	If we find KEEP, jump and recursively find. 
	   	- If succeed, then return. 
	   	- If failed, then 
	   		- If KILL is the only message in child, remove the KEEP message.
	   		- In any case, restart the search from the next index. 

	   	If we find KILL, jump and recursively find. 
	   		- If KILL is the only message of this board, return the new board.
	   		- Otherwise, keep using this board.  
	 */
	
	struct msg_t* contfrom = NULL;

	while (1) {
		board_lock(b);

		// Search from `contfrom` and wait until a match.
		struct search_env_t env = {.index = -1, .from = contfrom, .pattern = pattern, .found = NULL};
		queue_iforeach(b->queue, (queue_fn)search, (void*)&env);

		while (env.index < 0) {
			env.index = -1;
			env.from = contfrom;
			env.found = NULL;
			if (queue_find(b->queue, contfrom) < 0) {
				contfrom = NULL;
			}
			env.from = contfrom;

			struct timeval now;
			gettimeofday(&now, NULL);

			struct timespec timeout;
			timeout.tv_sec = now.tv_sec;
			timeout.tv_nsec = now.tv_usec * 1000;
			timeout.tv_nsec += 1000 * 1000 * 500; // 500 ms

			pthread_cond_timedwait(&b->cond, &b->mutex, &timeout);

			#ifndef NDEBUG
				char buffer[100];
				int i = 0;
				i = sprintf(buffer, "Searching for %s ", msg_show_label(pattern));
				i += msg_show_senders(pattern, buffer+i);
				i += sprintf(buffer+i, " => ");
				i += msg_show_receivers(pattern, buffer+i);
				log_trace("[Lock obtained]: %s in %s with %d, %p, %p", buffer, b->id, env.index, env.from, env.found);
				board_show_nolock(b);
			#endif

			queue_iforeach(b->queue, (queue_fn)search, (void*)&env);
		}




		struct msg_t *found = env.found;
		struct board_t *child = (struct board_t*)found->payload;
		struct board_t *grandchild;

		switch (found->label) {
		case MSG_FWD_KEEP: 

			/**
			 * First, try to read from the child.
			 */
			board_unlock(b);

			log_trace("Saw KEEP in %s. Reading again from %s", b->id, child->id);
			grandchild = board_read(child, pattern, out);

			// If succeed, return. 
			if (out->label == pattern->label) return b;
			
			/**
			 * If it failed, then the child contains no match, and a KILL.
			 * We need to either skip the KEEP and re-search, or delete the KEEP and re-search.
			 * But note, the KEEP may be changed/deleted since the thread was unlocked.
			 */
			board_lock(b);

			// If someone else has freed the KEEP, just return.
			int index = queue_find(b->queue, found);
			if (index < 0) {
				log_trace("Someone else deleted KEEP.");
				board_unlock(b);

				// Restart read from the beginning.
				contfrom = NULL;
				continue;
			}

			// If the child board has only a KILL message, 
			// then delete the KEEP message, and release the board.
			if (child->queue->head == child->queue->tail) {
				found = queue_ideq(b->queue, index);
				log_trace("KILL is the last message in %s.", child->id);

				log_trace("KEEP %s deleted from %s", ((struct board_t*)found->payload)->id, b->id);
				msg_free(found);

				// log_info("Read failed from KEEP in %s, restarting from 0", b->id);
				board_unlock(b);

				// Restart the search from the beginning.
				contfrom = NULL;
				continue;
			}

			log_trace("Read failed from KEEP in %s, restarting from %d", b->id, index+1);
			board_unlock(b);

			// Restart the search from right after the KEEP message.
			contfrom = found;
			continue;

		// Our board is being killed.
		case MSG_FWD_KILL:

			if (b->queue->head == b->queue->tail) {
				log_trace("KILL is the last message in %s.", b->id);
			}

			// Failed to find any message. Abort.
			// This case is only for readings initiated via a JUMP from KEEP messages.
			if (MSG_SET_SUB(pattern->receivers, found->senders)) {
				log_trace("Saw KILL in %s. Read failed.", b->id);
				board_unlock(b);
				return NULL;
			}
				
			// Otherwise. 
			int jump = b->queue->head == b->queue->tail ? 1 : 0;

			board_unlock(b);
			
			child = (struct board_t*)found->payload;
			log_trace("Saw KILL in %s. Read again from %s", b->id, child->id);
			grandchild = board_read(child, pattern, out);

			return jump == 1 ? grandchild : b;

		default:		
			// Mark and copy.
			found->receivers = MSG_SET_MINUS(found->receivers, pattern->receivers);
			memcpy(out, found, sizeof(struct msg_t));

			// If all received, delete the message.
			if (found->receivers == 0) msg_free(queue_ideq(b->queue, env.index));

			board_unlock(b);
			// log_info("Read success in %s %p", b->id, (void*)b);
			msg_log(b, out, 0);

			return b;
		}

		return NULL;
	}
}

PRIVATE void board_dbgfn(int i, struct msg_t* m, void* env) {
	char prefix[30];
	sprintf(prefix, "  %s => ", env);
	msg_show_prefix(m, prefix);
}

void board_show(struct board_t* b) {
	board_lock(b);
	board_show_nolock(b);
	board_unlock(b);
}

void board_show_nolock(struct board_t* b) {
	log_debug("Board %s %p ref %d", b->id, (void*)b, b->refcount);
	queue_iforeach(b->queue, (queue_fn)board_dbgfn, b->id);
}