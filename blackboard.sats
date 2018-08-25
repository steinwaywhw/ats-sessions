%{#
#include "./runtime.h"
%}

absvtype board = ptr

fun board_make (string): board = "mac#"
fun board_ref  (!board): board = "mac#"
fun board_free (board):  void  = "mac#"

//fun {} board_write (!board, msg): void
//fun {} board_read {a,b:set} (reader: set a, writer: set a, label: msglabel): msg 
//fun {} board_connect (string): board
//fun {} do_board_write (!board, msg): void
//fun {} do_board_read {a,b:set} (reader: set a, writer: set a, label: msglabel): msg 


