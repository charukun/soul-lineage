# Visual Review Lab preview

Visual Review Lab is reviewed through a static Cloudflare Pages project, not through a continuously running Codespace.

## Cloudflare Pages project

Use a dedicated Free-plan Pages project for this review branch.

- Repository: `charukun/soul-lineage`
- Production branch: `work/visual-review-lab-v2`
- Build command: `npm run build:review`
- Build output directory: `dist/rinne`
- Root directory: repository root
- Framework preset: none
- Node: 24

`npm run build:review` builds the real Rinne workspace and rewrites only the generated preview output so `/` opens the Visual Review Lab. It does not modify the game source entry.

The Pages project must remain isolated from the existing DEV/Production deployment. Do not point it at `develop` or `main`, and do not alter the existing GitHub Pages CI/CD.

## Normal loop

1. Push Visual Review Lab/model/motion/VFX changes to `work/visual-review-lab-v2`.
2. Cloudflare Pages rebuilds the same project URL.
3. Review the URL on mobile and send corrections.
4. Keep PR #23 Draft until the visual result is approved.

## Codespaces

Codespaces remain fallback-only for Git transport or asset operations that cannot be handled through the normal connector. Do not auto-start Review Lab in Codespaces and do not leave a Codespace running for visual review.
