
/**
 * Simple queue. Please #include this file in runtime.c
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

	// Navigate to the one before i.
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