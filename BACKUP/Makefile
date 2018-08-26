






# all: test_typechecking.tc
all: test_bitcoinpayment.tc 
	
# z3: session.dats test_typechecking.dats
	# patsopt -tc --constraint-export -d $< | patsolve_smt2 --printfile ./set.smt2 -i | tee ./constraints | z3 -t:2000 -smt2 -in 2>&1 | tee output | em -fgreen "^unsat" | em "^sat|^timeout|^unknown" #| grep -B1 "unknown"



%.tc: %.dats
	patsopt -tc --constraint-export -d $< | patsolve_smt2 --printfile ./set.smt2 -i | tee ./constraints | z3 -t:2000 -smt2 -in 2>&1 | tee output | em -fgreen "^unsat" | em "^sat|^timeout|^unknown" 


constraints.xx: 
	z3 -t:2000 -smt2 -in 2>&1 | tee output | em -fgreen "^unsat" | em "^sat|^timeout|^unknown" 


redisd:
	docker run --name redisd -d redis 

redis-cli:
	docker run -it --rm --link redisd:redis redis redis-cli -h redis -p 6379