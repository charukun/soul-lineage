# Application structure

This repository keeps every independently deployable web application under `apps/<id>`.

## Canonical applications

- `apps/rinne` — 100年生 — 輪廻転焦
- `apps/village` — MURAAAAAAA
- `apps/demon` — 尽喰廻遊
- `apps/review` — Visual Review Lab
- `apps/character-studio` — Character Studio
- `apps/pulse` — PULSE control plane
- `apps/wayfinder` — WAYFINDER public gallery
- `apps/eclipse` — standalone experimental game with its existing dedicated pipeline

Shared libraries remain under `packages/<id>`. Apps must not import another app.

## DEV identity

One independently deployable application owns one canonical DEV/public Worker URL and one PULSE target identity.

- Games and static developer tools use app-scoped Workers.
- PULSE and WAYFINDER keep their existing stable Worker names and URLs while their source moves under `apps/`.
- GitHub Pages is not a DEV publisher. Legacy `/dev/` Pages URLs must not be surfaced as DEV targets.
- RINNE-only runtime probes such as battle/motion/effects remain internal RINNE views and are reached from Visual Review Lab. They are not independent applications.

## Migration acceptance

1. Root `ops-board/` and `portal/` no longer exist; their sources live under `apps/pulse/` and `apps/wayfinder/`.
2. Character Studio is no longer a RINNE HTML entry. It has its own workspace, build output, Worker config and canonical DEV URL.
3. Visual Review Lab links Character Studio to that independent URL and keeps RINNE runtime probes explicitly scoped to RINNE.
4. RINNE no longer emits `characters.html`, `characters-advanced.html`, or the old Visual Review bridge `review.html`.
5. PULSE exposes the independent Workers as the DEV targets and does not reintroduce Pages DEV targets.
6. Existing PULSE and WAYFINDER public URLs remain stable.
7. Distribution planning/building recognizes independent static DEV apps without changing `main` or Production.
8. Tests, workflows, docs and path filters follow the new structure; no quality gate is weakened.
