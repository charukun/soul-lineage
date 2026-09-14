# Peer-hosted Shared World Operations

## Scope

The shared-world runtime remains peer hosted. `rinne-ops` is used only as a short-lived signalling rendezvous and operations surface. It does not own village simulation, combat authority, checkpoints, saves or inventory.

The manual SDP offer/answer UI remains the failure fallback. Normal players use the automatic room flow.

## Automatic signalling

`packages/platform-web/src/peer-signaling.js` talks to the existing PULSE Worker at `/api/peer-world/*`.

The Durable Object registry retains only:

- room/world identifiers and a short display label;
- host/guest authentication tokens on the server side;
- short-lived SDP offer/answer events;
- bounded host capability metadata;
- public operational telemetry.

Rooms expire after 10 minutes without activity. The registry is bounded by room, join, event and signal-size limits. PULSE public state never includes tokens or SDP payloads.

After WebRTC connects, gameplay continues through the peer mesh from `docs`/`packages/network`; Cloudflare is not in the gameplay data path.

## Host capability policy

MURAAAAAAA peers remain the only host-eligible devices. Candidate ranking uses a deterministic capability score based on the browser information that is actually available:

- foreground/background state;
- charging and battery level when `navigator.getBattery()` is available;
- hardware concurrency and device memory when exposed;
- Network Information API RTT/downlink/save-data when exposed;
- learned frame/GPU p95 from the existing adaptive-performance layer.

Missing signals are neutral. A capable mayor receives a small preference, but an obviously unstable mayor cannot override a substantially healthier host candidate. If any stable candidate exists, unstable/background/critically constrained candidates are excluded. Equal candidates fall back to join order then peer ID.

No fake temperature, battery or network reading is invented when the browser does not expose it.

## Migration SLO

The real Chromium WebRTC migration smoke records two user-visible service levels:

- Host loss to `migrating`/darkness detection: <= 4500 ms.
- Darkness migration start to reopened successor Host: <= 6000 ms.

These thresholds include the existing quorum lease and therefore do not weaken split-brain protection to achieve a faster number.

The browser artifact records the measured detection and reopen durations. A regression above either target fails the PR browser gate.

## PULSE

PULSE exposes only operational state:

- OPEN / MIGRATING / CLOSED;
- shortened Host reference and capability score;
- peer count;
- epoch and checkpoint revision;
- quorum minimum confirmation;
- last migration duration and SLO status;
- split-brain prevention count.

The panel is read-only. It cannot elect a Host or modify world state.

## Cost boundary

This phase adds no dedicated game server and no new paid runtime requirement. It reuses the existing `rinne-ops` Cloudflare Worker/Durable Object deployment. The design remains valid if a different signalling adapter is injected later.
