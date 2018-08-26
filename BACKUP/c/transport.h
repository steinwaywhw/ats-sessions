



struct transport_t {
	(void *) (*connect)    (void* this, void *addr);
	(void *) (*disconnect) (void* this, void *addr);
	(void *) (*send)       (void* this, void *json);
	(void *) (*receive)    (void* this)
};
