
PATSOPT=patsopt 
CC=gcc
CFLAGS += -g -std=c99 -D_GNU_SOURCE -I$(PATSHOME) -I$(PATSHOME)/ccomp/runtime -I$(PATSHOME)/contrib/atscntrb -DATS_MEMALLOC_LIBC

%_dats.c: %.dats
	$(PATSOPT) -o $@ -d $< 

%_sats.c: %.sats
	$(PATSOPT) -o $@ -s $< 

a.out: json_dats.c thread_dats.c transport_dats.c main_dats.c uuid_dats.c
	$(CC) $(CFLAGS) -ljansson -lpthread -lnng $^ -o $@

clean:
	rm -rf *ats.c