# WebUI Completion Contract

## Required routes
- `/control-center`
- `/control-center/providers`
- `/control-center/agents`
- `/control-center/workflows`
- `/control-center/evidence`
- `/control-center/repairs`
- `/control-center/settings`

## Required runtime bindings
- queue depth
- active packets
- pending questions
- provider health + failover state
- current mode
- repair timeline
- evidence history

## Required proof
- each route renders
- each panel loads real runtime data
- repair/safemode blocks normal UI on critical failure
