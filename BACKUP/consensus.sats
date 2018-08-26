staload "./socket.sats"


abstype partyid

datatype raftstate = 
| Follower
| Candidate
| Leader

fun elect (!socket): partyid

fun serverloop (raftstate): void