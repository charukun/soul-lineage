# DEV Asset Origin

DEV runtime assets that are not app-core bytes are served from the existing Visual Review Lab Cloudflare Workers Static Assets deployment.

- Origin: `https://soul-lineage-review-dev.c-okamoto.workers.dev/library/`
- Asset responses are CORS-enabled and immutable-cacheable through `apps/review/public/_headers`.
- Runtime delivery paths are content-addressed with the pinned Git blob SHA.
- Upstream repository/revision/path remains provenance only. Runtime code must not derive a delivery URL from the upstream host.
- Active runtime records must be materialized under `apps/review/public/library/`. Large binaries that exceed Connector-safe transfer use a one-shot Hosted Runner materializer with pinned Git blob verification; no active motion pack is dropped merely because Connector transfer is unsuitable.
- One project asset is capped at 20 MiB, below the Workers Static Assets per-file ceiling. Larger authored assets must be split by semantic asset boundaries rather than byte concatenation.
- Production does not inherit this DEV origin. A Production asset origin requires an explicit Production change.

Current materialized groups:

- RINNE motion review: eight KayKit motion packs, two Quaternius UAL packs, fourteen CMU parkour BVH motions, three Mesh2Motion motion packs and the Mesh2Motion review mannequin.
- RINNE object/sound review: 54 curated Kenney CC0 medieval/fantasy environment models and 43 combat/life/UI audio assets (97 unique Kenney assets total), pinned with provenance and self-hosted.
- Demon: five pinned Gobkit model surfaces.

The shared `@soul/assets` runtime-origin helper owns URL construction and the third-party runtime host deny-list.
