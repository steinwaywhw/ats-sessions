#include "./utils.h"

/**
 * Roles are immutable. 
 */

typedef int   role;
typedef int[] roleset;


roleset roleset_make(int count, ...);
void roleset_free(roleset rs);

bool roleset_empty(roleset rs);
bool roleset_has(roleset rs, role r);
bool roleset_equals(roleset rs1, roleset rs2);


bool roleset_intersect
