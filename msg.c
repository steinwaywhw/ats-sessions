


/**
 * Messages. Please #include this file in runtime.c
 */

const char* msg_show_label(struct msg_t* m) {
	switch (m->label) {
	case MSG_MSG        : return "MSG";
	case MSG_BRANCH     : return "BRANCH";
	case MSG_INIT       : return "INIT";
	case MSG_CLOSE      : return "CLOSE";
	case MSG_SYNC_INIT  : return "SYNC_INIT";
	case MSG_SYNC_CLOSE : return "SYNC_CLOSE";
	case MSG_FWD_KEEP   : return "KEEP";
	case MSG_FWD_KILL   : return "KILL";
	default             : panic("Unknown label.");
	}
	return NULL;
}

int msg_show_senders(struct msg_t* m, char* buffer) {
	int i = 0;
	for(unsigned int mask = 0x80; mask; mask >>= 1) {
		i += sprintf(buffer+i, "%d", !!(mask & m->senders));
	}
	return i;
}

int msg_show_receivers(struct msg_t* m, char* buffer) {
	int i = 0;
	for(unsigned int mask = 0x80; mask; mask >>= 1) {
		i += sprintf(buffer+i, "%d", !!(mask & m->receivers));
	}
	return i;
}

void msg_show(struct msg_t* m) {
	msg_show_prefix(m, "\t");
}

void msg_show_prefix(struct msg_t* m, const char* prefix) {
	char* label;
	char buffer[100];

	int i = sprintf(buffer, "%s", prefix);
	i += sprintf(buffer+i, "[%s] [", msg_show_label(m));
	i += msg_show_senders(m, buffer+i);
	i += sprintf(buffer+i, "] [");	
	i += msg_show_receivers(m, buffer+i);
	i += sprintf(buffer+i, "]");
	
	switch (m->label) {
	case MSG_FWD_KEEP:
	case MSG_FWD_KILL:
		i += sprintf(buffer+i, "[%s]", ((struct board_t*)m->payload)->id);
		break;
	case MSG_SYNC_INIT:
	case MSG_SYNC_CLOSE:
		i += sprintf(buffer+i, " [");
		for(unsigned int mask = 0x80; mask; mask >>= 1) {
			i += sprintf(buffer+i, "%d", !!(mask & (int32_t)m->payload));    	
		} 
		sprintf(buffer+i, "]");
		break;
	}
	log_debug("%s", buffer);
}

PRIVATE void msg_log(void* b, void* m, int rw) {
	struct board_t* board = (struct board_t*)b;
	struct msg_t* msg = (struct msg_t*)m;
	char* action = rw == 0 ? "read from" : "written to";

	switch (msg->label) {
	case MSG_MSG        : log_debug("Message %s %s %s", msg->payload, action, board->id); break;
	case MSG_BRANCH     : log_debug("Branch %s %s %s", (int)msg->payload == 0 ? "left" : "right", action, board->id); break;
	case MSG_CLOSE      : log_debug("Close %s %s", action, board->id); break;
	case MSG_FWD_KEEP   : log_debug("Keep %s %s %s", ((struct board_t*)msg->payload)->id, action, board->id); break;
	case MSG_FWD_KILL   : log_debug("Kill %s %s %s", ((struct board_t*)msg->payload)->id, action, board->id); break;
	}
}

struct msg_t* msg_make(int label, int32_t senders, int32_t receivers, void* payload) {
	struct msg_t* m = (struct msg_t*)malloc(sizeof(struct msg_t));
	m->label = label;
	m->senders = senders;
	m->receivers = receivers;
	m->payload = payload;
	return m;
}

/**
 * Free the message. If the payload is a blackboard, free the board as well.
 */
void msg_free(struct msg_t* msg) {
	struct board_t* child;
	switch (msg->label) {
	case MSG_FWD_KILL:
	case MSG_FWD_KEEP:
		child = (struct board_t*)msg->payload;
		board_free(child);
	}
	free(msg);
}