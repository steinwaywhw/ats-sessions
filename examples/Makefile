



FRONTEND=../frontend


all: ex-queue.const ex-queue.tc

clean: *.const *.tc
	rm -rf $?

%.const: %.dats
	patsopt -tc --constraint-export -d $< | patsolve_smt2 -i preamble --printfile $(FRONTEND)/set.smt2 -i - > $@

%.tc: %.const 
	z3 -t:2000 -smt2 $< 2>&1 | tee $@ | em -fgreen "^unsat" | em "^sat|^timeout|^unknown" 

