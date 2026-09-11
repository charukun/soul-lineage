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

The workflow `.github/workflows/review-preview.yml` builds on each push to `work/visual-review-lab-v2`. Deployment is disabled until initial Cloudflare setup is complete.

After creating the dedicated Worker credentials, configure repository Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Then configure repository Actions variable:

- `REVIEW_PREVIEW_ENABLED=true`

The workflow uses concurrency cancellation, so superseded pushes do not need to finish before the newest preview is built.

## Normal loop

1. Push Visual Review Lab/model/motion/VFX changes to `work/visual-review-lab-v2`.
2. GitHub Actions builds the static preview and runs the asset-limit guard.
3. The prebuilt assets are deployed to the same Worker URL.
4. Review that URL on mobile and send corrections.
5. Keep PR #23 Draft until the visual result is approved.

If Cloudflare deployment is temporarily unavailable, source work and normal CI can continue; only the preview URL remains on the previous successful revision. The preview path must never block ordinary development.

## Large assets and deploy guards

`scripts/check-review-assets.mjs` runs as part of `npm run build:review` and fails before deployment when the generated preview would exceed Workers Static Assets limits used by this workflow:

- more than 20,000 static files
- any individual static asset larger than 25 MiB

Assets at or above 20 MiB emit a warning so they can be moved before they become blockers. Do not force oversized GLB/textures through the preview bundle. Move them to the repository's approved large-asset path (for example R2) and let Review Lab reference them by URL.

## Source-of-truth rule

The Review Lab must consume the same character/model/motion/VFX source modules and assets used by the game. Do not create review-only copies of production assets or animation logic. `review-adapter.js` is the review integration surface for wiring the production sources into the Lab.

## Codespaces

Codespaces remain fallback-only for Git transport or asset operations that cannot be handled through the normal connector. Do not auto-start Review Lab in Codespaces and do not leave a Codespace running for visual review.

## Asset integration verification

The Lab loads the exact Shino model from the current Rinne simulator, pinned Quaternius motion, KayKit sword and Kenney sprites. The fixed inputs and hashes are in `packages/assets/src/review-catalog.js`; built licenses and provenance are in `asset-review/`. See `docs/ASSET_REVIEW_INTEGRATION.md`.

The dedicated workflow runs `npm run test:review-browser` before deployment and against the stable workers.dev URL after deployment, checking the actual built JS and asset manifest commit. Screenshots and reports are retained as an Actions artifact for 14 days. The normal PR fast gate remains browser-free. Software WebGL at a mobile viewport is not physical Pixel Fold performance approval.
