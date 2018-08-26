
CFLAGS=-std=c11 -g -O0  -DLOG_USE_COLOR -DDEBUG
CFLAGS+=-D_GNU_SOURCE -I$(PATSHOME) -I$(PATSHOME)/ccomp/runtime -I$(PATSHOME)/contrib/atscntrb -DATS_MEMALLOC_LIBC
LDFLAGS=-lpthread 
PATSOPT=patsopt --constraint-ignore

all: test.tc test_dats 
	mv test_dats a.out

clean: 
	rm -rf *.const *.tc *_dats.c *_sats.c *.o examples/*.const examples/*.tc *.dSYM

%.const: %.dats
	patsopt -tc --constraint-export -d $< | patsolve_smt2 -i preamble --printfile ./set.smt2 -i - > $@

%.tc: %.const 
	z3 -t:2000 -smt2 $< 2>&1 | tee $@ | em -fgreen "^unsat" | em "^sat|^timeout|^unknown" 

%_dats.c: %.dats
	$(PATSOPT) -o $@ -d $< 

%_sats.c: %.sats
	$(PATSOPT) -o $@ -s $< 

test_dats: endpoint_dats.o libsession_dats.o log.o runtime.o thread_dats.o test_dats.o
