# Visual Review Lab preview

Visual Review Lab is reviewed through a static Cloudflare Workers deployment built by GitHub Actions, not through a continuously running Codespace and not through Cloudflare Pages Git builds.

## Why this path

The repository is public, so standard GitHub-hosted Actions runners can build the preview without consuming the account's private-repository Actions minute allowance. Cloudflare only receives the already-built static assets. This avoids making the Pages Free monthly build/deploy allowance a dependency of the visual correction loop.

## Cloudflare Worker

Use one dedicated Workers Free project for the review branch.

- Worker name: `rinne-visual-review`
- Build: GitHub Actions runs `npm run build:review`
- Deploy: `npx --yes wrangler@4 deploy --config wrangler.review.jsonc`
- Static output: `dist/rinne`
- Review URL: the Worker's stable `workers.dev` URL

`npm run build:review` builds the real Rinne workspace and rewrites only the generated preview output so `/` opens the Visual Review Lab. It does not modify the game source entry. The same command also validates Workers Static Assets limits before deployment.

The Worker must remain isolated from the existing DEV/Production deployment. Do not alter the existing GitHub Pages CI/CD, `develop`, or `main`.

## GitHub setup

The workflow `.github/workflows/review-preview.yml` builds on each push to `work/visual-review-lab-v2`.

Repository Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Repository Actions variable:

- `REVIEW_PREVIEW_ENABLED=true`

The workflow uses concurrency cancellation, so superseded pushes do not need to finish before the newest preview is built.

## Fast visual-review policy

Visual Review Lab exists for rapid human visual review on the target device. Normal correction pushes must not wait for heavyweight browser E2E or full motion playback verification.

Normal loop:

1. Collect one correction batch from the user.
2. Implement the batch against the real shared character/model/motion/VFX sources and Review Lab integration.
3. Run only the minimum build/static checks needed to avoid publishing a broken bundle.
4. Push the completed batch to `work/visual-review-lab-v2`; avoid intermediate pushes when practical.
5. GitHub Actions builds and deploys directly to the dedicated Worker.
6. When deployment succeeds, tell the user to reload the stable URL and perform visual confirmation on the target device.
7. Iterate from the user's feedback.
8. Keep PR #23 Draft until the visual result is explicitly approved.

Do not run `test:review-browser`, Playwright, full-motion traversal, screenshot capture, or long public-URL waits on every normal Visual Review Lab update. Those checks are reserved for explicit debugging, Ready-for-review preparation, or when a change directly affects the deployment/runtime contract and lightweight checks are insufficient.

A normal Visual Review Lab handoff requires successful build and Worker deployment. Human visual approval is performed by the user, not inferred from automated browser screenshots.

If Cloudflare deployment is temporarily unavailable, source work and normal CI can continue; the stable preview URL remains on the previous successful revision. Report that the preview is stale rather than asking the user to review it. Preview failure must never block unrelated ordinary development.

## Review scope and environment separation

The Visual Review Worker is a disposable review surface for the Draft branch, not DEV and not Production. Changes visible there do not imply that `develop`, normal DEV, `main`, or Production has changed. Promotion happens only through the normal Ready PR and Integration flow after visual approval.

The stable preview URL is publicly reachable unless a separate access-control layer is deliberately configured. Do not put secrets, credentials, personal data, private administration functions, or other material unsuitable for public access into the Review Lab or its generated static assets.

## Large assets and deploy guards

`scripts/check-review-assets.mjs` runs as part of `npm run build:review` and fails before deployment when the generated preview would exceed Workers Static Assets limits used by this workflow:

- more than 20,000 static files
- any individual static asset larger than 25 MiB

Assets at or above 20 MiB emit a warning so they can be moved before they become blockers. Do not force oversized GLB/textures through the preview bundle. Move them to the repository's approved large-asset path and let Review Lab reference them by URL.

## Source-of-truth rule

The Review Lab must consume the same character/model/motion/VFX source modules and assets used by the game. Do not create review-only copies of production assets or animation logic. `review-adapter.js` is the review integration surface for wiring the production sources into the Lab.

## Internal observation before declaring a rendering limitation

For requested model/motion inspection, start the actual local Lab before falling
back to CPU mesh evidence. Run from the repository root:

```sh
npm ci
npm run review:local:setup
npm run review:local -- --mode sequence --time 3.33 --playback
```

`review:local` starts Vite on loopback and Chromium/SwiftShader in the same process
tree. It loads the real 30-second viewer and shipped Shino, checks WebGL2, captures
front/side/three/back at the specified time, and optionally records uninterrupted
normal-speed playback. It writes source hashes, failure stage, captures and the
honest observation/approval state to `artifacts/review-local-motion/report.json`.
Use `--out` for separate before/after evidence; `--mode combination`, `single` or
`posture` narrows the inspection. No deployment, paid provider or remote asset
generation is involved. Browser errors fail the command instead of becoming a pass.

Do not point a remote cloud browser at worker localhost and conclude the Lab is
broken when the networks are isolated. Do not change the sandbox/network policy.
Binding to `127.0.0.1` also avoids the network-interface enumeration used by a
wildcard Vite listener in restricted workers. If concurrent Playwright installs
hold a shared cache lock, use one per-worker `PLAYWRIGHT_BROWSERS_PATH` for both
installation and review. `REVIEW_CHROMIUM_PATH` can select an already-installed
compatible browser. Setup first tries Playwright, then a pinned npm-distributed
Linux x64 Chromium/SwiftShader bundle if that download fails. `-- --bundled` selects
that path directly. The bundle stays in the checkout's ignored dependency cache;
archive ownership is not restored. Canvas recording uses MediaRecorder, so no
separate FFmpeg download is needed. Missing browser/download/launch/WebGL failures are distinct
stages; preserve the report and use another authorized execution route if needed.

Inspect the PNGs and view the video at 1x before claiming visual improvement.
A recording is not proof it was watched, and software rendering is not physical
Pixel Fold performance. CPU evidence remains available with those limits after
the internal path has actually been attempted. This bounded authoring check does
not require unrelated full E2E traversal or CI polling on each correction.

## AI repair boundary

Visual Review Lab is the presentation and human-approval surface, not the AI modeling control plane. It must not own target-image persistence, model-provider invocation, API keys, paid generation, outbound reference acquisition, or the correction-loop state machine.

Reference discovery, vetted public-GitHub evidence, internal Golden baselines, target-image interpretation, render/judge/repair iteration, and edits to the real shared model source belong to the implementation-worker and character-production/reference-intelligence layers. Those layers may prepare a candidate using the task's explicit target plus permitted reference evidence, then publish that real candidate into the Lab for fixed-view comparison and human approval.

Do not add Fal/fal.ai or another hidden image-to-3D backend to the Review Lab. The Lab should remain device-independent beyond ordinary browser rendering and should not require browser-local state to continue a modeling task on another machine.

### Machine observation mode

The AI implementation worker may reuse the Lab as a deterministic observation surface without making the Lab the AI control plane. Open the normal review route with `machine=1` plus the existing state parameters, for example `?machine=1&preset=model.SHINO&clip=通常%20/%20自然体&t=0&camera=front&playing=0`.

When the real model is loaded the page exposes `window.__reviewMachine`. The worker may call:

- `ready()` to confirm the real Lab model is loaded;
- `recipe()` to record the selected preset/source/clip/time/camera/build and actual canvas dimensions;
- `capture({ view, time })` for one deterministic Lab-canvas PNG;
- `captureSet({ views, time })` for the default `front / three / right / back` comparison set or an explicit supported view list.

Machine capture temporarily pauses playback, uses the existing `window.__reviewLab` camera/seek path, waits for rendered frames, captures the actual Lab canvas, and restores the previous review state. It does not invoke an AI provider, acquire references, upload images, store targets in the browser, or grant visual approval. `visualApproval` in the emitted recipe remains `pending`.

An Astra/implementation-worker self-repair loop should therefore be `reference intelligence + explicit target -> edit real source -> local Lab machine capture -> compare/judge -> repair -> repeat`. Push one completed candidate batch to the Lab branch for public human review rather than publishing each internal repair iteration.

## Codespaces

Codespaces remain fallback-only for Git transport or asset operations that cannot be handled through the normal connector. Do not auto-start Review Lab in Codespaces and do not leave a Codespace running for visual review.

## Heavy verification

Heavy browser verification remains available as an explicit tool, but it is not part of the default fast loop. Use it only when specifically needed for runtime debugging, promotion readiness, or Production-grade verification. Software WebGL at a mobile viewport is not physical Pixel Fold performance approval.
