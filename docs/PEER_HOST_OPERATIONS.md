# Peer-hosted Shared World Operations

## Scope

The shared-world runtime remains peer hosted. `rinne-ops` is used only as a short-lived signalling rendezvous and operations surface. It does not own village simulation, combat authority, checkpoints, saves or inventory.

Normal gameplay preserves the explicit, non-hostile friend invitation contract. Creating an invitation may attach an optional private signaling descriptor so the guest's answer is returned automatically. The existing SDP invitation and manual answer controls remain usable if signaling is unavailable.

## Automatic signalling

`packages/platform-web/src/peer-signaling.js` talks to the existing PULSE Worker at `/api/peer-world/*`.

The Durable Object registry retains only:

- room/world identifiers and a short display label;
- private invitation and host/guest authentication tokens on the server side;
- short-lived SDP offer/answer events;
- bounded host capability metadata;
- public operational telemetry.

Rooms expire after 10 minutes without activity. The registry is bounded by room, join, event and signal-size limits. Joining requires the private invitation token in the Authorization header. Public discovery returns no rooms. PULSE exposes anonymous operational telemetry without room IDs, world IDs, village names, invitation tokens or SDP payloads. A visitor cannot claim host eligibility or acquire signaling controller access. Standby capability is restricted to an explicitly created standby room and is not granted by the normal friend-visit flow.

The owner creates the signaling room only after deliberately issuing an invitation. The guest accepts only the same offer embedded in that active invitation. Automatic answers are accepted only for a guest to whom that owner offered the connection; malformed answers cannot grant controller access. After WebRTC connects, friend visitors receive only the existing exterior snapshot and read-only authority heartbeat. Cloudflare is not in the gameplay data path and never stores checkpoints or private save data. The shared peer mesh and full-checkpoint migration core remain available to explicit eligible-peer tests, separate from friend sightseeing.

## Host capability policy

MURAAAAAAA peers remain the only host-eligible devices. Candidate ranking uses a deterministic capability score based on the browser information that is actually available:

- foreground/background state;
- charging and battery level when `navigator.getBattery()` is available;
- hardware concurrency and device memory when exposed;
- Network Information API RTT/downlink/save-data when exposed;
- learned frame/GPU p95 from the existing adaptive-performance layer.

Missing signals, including explicit null values returned by browsers without battery/network APIs, are neutral. A capable mayor receives a small preference, but an obviously unstable mayor cannot override a substantially healthier host candidate. If any stable candidate exists, unstable/background/critically constrained candidates are excluded. Equal candidates fall back to join order then peer ID.

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

The panel is read-only and anonymous. It cannot discover/join a village, elect a Host or modify world state. The normal friend session has no shared full checkpoint, so its checkpoint revision is zero; no quorum ACKs are invented for telemetry.

## Cost boundary

This phase adds no dedicated game server and no new paid runtime requirement. It reuses the existing `rinne-ops` Cloudflare Worker/Durable Object deployment. The design remains valid if a different signalling adapter is injected later.
