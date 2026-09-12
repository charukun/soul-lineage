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

## Codespaces

Codespaces remain fallback-only for Git transport or asset operations that cannot be handled through the normal connector. Do not auto-start Review Lab in Codespaces and do not leave a Codespace running for visual review.

## Heavy verification

Heavy browser verification remains available as an explicit tool, but it is not part of the default fast loop. Use it only when specifically needed for runtime debugging, promotion readiness, or Production-grade verification. Software WebGL at a mobile viewport is not physical Pixel Fold performance approval.
