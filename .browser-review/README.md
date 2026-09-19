# Browser Review Control

This branch is an isolated browser-control plane. It is intentionally not merged into develop or main.

Updating only `.browser-review/command.json` triggers one Chromium review run. Normal application pushes, PRs, develop merges and Fast DEV publication do not trigger this workflow.

Supported actions: `wait`, `clickText`, `clickRole`, `clickSelector`, `tap`, `drag`, `key`, `scroll`, `evaluate`, `screenshot`.

Evidence is uploaded as a seven-day artifact containing screenshots, `review.json`, console/page errors, failed requests, frame-time samples, long tasks and WebGL information.
