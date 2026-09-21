# RINNE review surfaces

This directory is the implementation boundary for Visual Review surfaces owned by 百年転生.

The public entrypoints remain at `apps/rinne/review-*.html` so the canonical extensionless URLs do not change. Runtime implementation belongs under `src/review/<domain>/`.

Do not move RINNE runtime-dependent review code into `apps/review`. The Visual Review Lab is the hub; RINNE owns these probes.
