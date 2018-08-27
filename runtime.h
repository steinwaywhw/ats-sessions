#pragma once

/* macro comments */
#define PRIVATE 

#include <pthread.h>
#include <stdatomic.h>

/**
 * Utils.
 */

void    panic    (const char* msg);
int32_t arr2bits (int n, int* arr);
void    step     (); // Dummy getchar() when DEBUG.
void    install_handler();
void    g_states();

/**
 * Use `PACK(a, b, c)` to generate `arr2bits(3, (int[3]){a, b, c})`
 */
// #define ARGC(...)  ARGC_(__VA_ARGS__, 10,9,8,7,6,5,4,3,2,1,0)
// #define ARGC_(...) ARGC__(__VA_ARGS__)
// #define ARGC__(_1, _2, _3, _4, _5, _6, _7, _8, _9, _10, N, ...) N
// #define PACK(...) arr2bits(ARGC(__VA_ARGS__), (int[ARGC(__VA_ARGS__)]){__VA_ARGS__})

/**
 * Simple queue. 
 *
 * Note, the queue owns the payload, until it gets dequeued.
 */

struct queue_node_t {
	void* payload;
	struct queue_node_t* next;
};

struct queue_t {
	struct queue_node_t* head;
	struct queue_node_t* tail;
};


struct queue_t* queue_make ();
int             queue_free (struct queue_t* q); // Return number of nodes.
void            queue_enq  (struct queue_t* q, void* payload);
void*           queue_deq  (struct queue_t* q);
void*           queue_ideq (struct queue_t* q, int i);
int             queue_find (struct queue_t* q, void* addr);

typedef void (*queue_fn)(int, void*, void*);
void queue_iforeach(struct queue_t* q, queue_fn, void*);

/**
 * Messages.
 * 
 * Note that, the message does not own the payload.
 */

enum {
	MSG_MSG,  
	MSG_BRANCH, 
	MSG_CLOSE,
	MSG_INIT,
	MSG_SYNC_CLOSE,
	MSG_SYNC_INIT,
	MSG_FWD_KEEP,
	MSG_FWD_KILL
};

#define MSG_SET_ADD(a, x)   ((a) | (1 << (b)))
#define MSG_SET_MINUS(a, b) ((a) & (~(b)))
#define MSG_SET_SUB(a, b)   (((a) | (b)) == (b))
#define MSG_SET_SUP(a, b)   (((a) | (b)) == (a))
#define MSG_SET_CAP(a, b)   ((a) & (b))
#define MSG_SET_CUP(a, b)   ((a) | (b))

#define MSG_LABEL_MATCH(m, p)  ((p)->label < 0 || (m)->label == (p)->label)
#define MSG_RECVER_MATCH(m, p) ((p)->receivers < 0 || MSG_SET_SUP((m)->receivers, (p)->receivers))
#define MSG_SENDER_MATCH(m, p) ((p)->senders < 0 || MSG_SET_SUP((m)->senders, (p)->senders))
#define MSG_MATCH(m, p)        (MSG_LABEL_MATCH(m,p) && MSG_SENDER_MATCH(m,p) && MSG_RECVER_MATCH(m,p))

struct msg_t {
	int label;
	int32_t senders;   // The union of all roles of the sending endpoints.
	int32_t receivers; // The union of all roles of the receiving endpoints.
	void* payload;
};

struct msg_t* msg_make (int label, int32_t senders, int32_t receivers, void* payload);
void          msg_free (struct msg_t* msg);

void          msg_show           (struct msg_t* msg);
void          msg_show_prefix    (struct msg_t* msg, const char* prefix);
const char*   msg_show_label     (struct msg_t* msg);
int           msg_show_senders   (struct msg_t* msg, char* buffer);
int           msg_show_receivers (struct msg_t* msg, char* buffer);
/**
 * Blackboard.
 */

struct board_t {
	pthread_mutex_t mutex;
	pthread_cond_t  cond;
	
	atomic_int refcount;
	struct queue_t* queue;
	char id[64];
};


struct board_t* board_make   (const char* id);
struct board_t* board_ref    (struct board_t* board);
int             board_free   (struct board_t* board);  // Return number of messages. 
 
struct board_t* board_write  (struct board_t* board, struct msg_t* msg);
struct board_t* board_read   (struct board_t* board, struct msg_t* pattern, struct msg_t* out);
 
void            board_lock   (struct board_t* board);
void            board_unlock (struct board_t* board);

void            board_show        (struct board_t* board);
void            board_show_nolock (struct board_t* board);

/**
 * Endpoint.
 *
 * Endpoint does not own the board, but it owns the payload.
 */

struct ep_t {
	struct board_t* board;
	int32_t self;
	int32_t full;
};

#define ep_get_self(x) (((struct ep_t*)(x))->self)
#define ep_get_full(x) (((struct ep_t*)(x))->full)

struct ep_t* ep_make  (int32_t full, int32_t self, struct board_t* board);
void         ep_free  (struct ep_t* ep); 
struct ep_t* ep_split (struct ep_t* ep, int32_t split);

void         ep_send  (struct ep_t* ep, int label, int32_t from, int32_t to, void* payload);
void*        ep_recv  (struct ep_t* ep, int label, int32_t from, int32_t to);
void         ep_sync  (struct ep_t* ep, int label, int32_t syncer);

struct ep_t* ep_link  (struct ep_t* ep1, struct ep_t* ep2);

void         ep_show  (struct ep_t* ep);



