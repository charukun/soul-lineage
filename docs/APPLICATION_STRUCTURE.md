# Application structure

Every independently deployable web application lives under `apps/<id>`.

- `apps/rinne` — 100年生 — 輪廻転焦
- `apps/village` — MURAAAAAAA
- `apps/demon` — 尽喰廻遊
- `apps/review` — Visual Review Lab
- `apps/character-studio` — キャラクター工房
- `apps/pulse` — PULSE
- `apps/wayfinder` — WAYFINDER
- `apps/eclipse` — standalone experimental game

Shared code stays under `packages/<id>`.

DEV rule: one independent app owns one canonical DEV/public Worker URL and one PULSE target identity. GitHub Pages is not a DEV publisher. RINNE-only runtime probes such as battle, motion, assets and effects remain internal RINNE views reached from Visual Review Lab; they are not independent apps.

PULSE and WAYFINDER keep their existing stable Worker names while their source lives under `apps/`.
