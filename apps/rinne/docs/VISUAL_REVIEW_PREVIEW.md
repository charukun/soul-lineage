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

`npm run build:review` builds the real Rinne workspace and rewrites only the generated preview output so `/` opens the Visual Review Lab. It does not modify the game source entry.

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
2. GitHub Actions builds the static preview.
3. The prebuilt assets are deployed to the same Worker URL.
4. Review that URL on mobile and send corrections.
5. Keep PR #23 Draft until the visual result is approved.

If Cloudflare deployment is temporarily unavailable, source work and normal CI can continue; only the preview URL remains on the previous successful revision. The preview path must never block ordinary development.

## Large assets

Cloudflare Workers Static Assets currently limits an individual static asset to 25 MiB. Do not force oversized GLB/textures through the preview bundle. If a review asset exceeds that size, use the repository's large-asset path (for example R2 or another approved asset distribution path) and let Review Lab reference it.

## Codespaces

Codespaces remain fallback-only for Git transport or asset operations that cannot be handled through the normal connector. Do not auto-start Review Lab in Codespaces and do not leave a Codespace running for visual review.
