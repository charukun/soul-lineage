# Integration stale refresh / branch janitor task start

Start develop: `9449509a2b7a8318baa5c87ad1ff61d8a6575d3a`

Scope:
- Reimplement the still-missing non-overlapping stale Ready PR refresh from superseded Draft #724 against the current Fast Lane/Fast Repair architecture.
- Add a conservative merged-branch janitor that never deletes develop/main/default/protected/open-PR/unmerged branches.
- Preserve review, hold, dependency, exact-head, main and Production gates.

No substantive implementation is contained in this marker.
