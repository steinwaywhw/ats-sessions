#include "stdio.h"
#include "assert.h"
#include "stdlib.h"

#include "nanomsg/nn.h"
#include "nanomsg/bus.h"
#include "nanomsg/ws.h"

#include "jansson.h"





// json_t* receive(int sock) {
// 	char *buf = NULL;
// 	int recv = nn_recv(sock, &buf, NN_MSG, 0);
// 	assert(recv > 0);

// 	json_t *obj = json_loads(buf, 0, NULL);
// 	nn_freemsg(buf);

// 	return obj
// }

// void send(int sock, json_t* payload) {
// 	char* buf = json_dumps(payload, )
// }




int main(int argc, char **argv) {
	int sock = nn_socket(AF_SP, NN_BUS);
	assert(sock >= 0);
	nn_bind(sock, "ipc:///tmp/device1.ipc");
	nn_device(sock, -1);

    int err = nn_errno();
	return 0;
}