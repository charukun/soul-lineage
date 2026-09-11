# BGM150 integration — blocked source import, not Ready

Repository: `charukun/soul-lineage`  
Implementation base checked: `69ea1f714e6c07bea079884ab7ebc0088f0feaa9` (develop)  
Requested source: Library `/soul-lineage/work-handoff/bgm-150/`  
Status: **Draft. The 150 original audio files and the complete original UI have not been materialized. No hosted audition UI has been integrated.**

## What is implemented

`packages/audio/tools/import-bgm150.mjs` accepts an already materialized source directory and reads its original Studio `script#catalogData`, without executing HTML. It validates collection/schema, 150 unique IDs, 48 tracks per game plus six common tracks, three-game availability, duration/loop metadata and source licensing status. It copies all 150 MP3 and 150 MIDI files only after their catalog SHA-256 matches. Missing assets, old collections, duplicate paths/digests, symlinks, traversal, absent evidence and an existing destination are rejected. Staging is removed on failure. File size and total import budgets are bounded. No placeholder songs, inferred catalogs, new compositions or automatic licence clearance are created.

The exact source HTML, catalog, selected original evidence and a per-file size/SHA-256 manifest are preserved. Output remains `source-import-only`, `readyForReview: false`, with audio/UI verification marked not run. This output is **not a deployable Studio**: the original single-file UI still contains its embedded previews/ZIP controls, and optional masters/Ogg are not copied by this importer. Do not publish it as the requested ZIP-free UI.

`packages/audio/tools/audit-bgm150.mjs` provides sequential full-MP3 decoding through FFmpeg/ffprobe. It rechecks each MP3 hash, codec/sample rate/channels, finite PCM, full-scale clipping, near-silence, decoded duration and the actual samples at declared loop points. It retains only streaming PCM chunks rather than full decoded tracks. Missing or corrupt tracks are failures, not skips. Review heuristics flag isolated impulses and loop sample steps; the report explicitly does not certify perceptual noise, loudness/true peak, music quality, browser scheduling, device performance or licensing. Any failure/review warning causes a nonzero CLI exit.

No game app, existing `@soul/audio` runtime/export, workspace dependency, lockfile, CI/CD workflow, main or Production code was changed. These are preparation tools, not a replacement for the source package's player.

## Actual verification in this WORK

- Node.js **22.16.0**: syntax checks of all three new JavaScript files passed.
- `node --test packages/audio/tests/bgm150-import.test.mjs`: **30 passed, 0 failed, 0 skipped**. Tests generate synthetic metadata/byte fixtures under a temporary directory and remove them. They are not the user's music and do not prove the source package passes.
- Separate local codec smoke: **7 assertion groups passed** using temporary, generated test tones. Actual mono 8 kHz/stereo 44.1 kHz MP3 full decode, metadata mismatch rejection, oversized decode rejection and corrupt MP3 rejection were exercised. No generated tone is included as a game asset.
- Repository CI targets Node 24. Local `npm ci` and the complete repository `scripts/validate.mjs fast` were **not run**: no full local checkout was obtained; GitHub reads/writes use the connected API and container Git access failed DNS resolution. Check the exact PR head's normal CI separately.
- Source 150-track MP3/Ogg/master inspection, HTTP/browser UI checks and device load measurements were **not run**. Prior Library validation reports remain prior-WORK evidence, not this WORK's results.

## Blocker and source evidence

Library search returned text excerpts of the latest `Rinne_BGM_150_Studio.html` (2026-09-11 05:43:52 UTC), `Rinne_BGM_150_Noise_Report.md` and `Rinne_BGM_150_Validation.md`. It did not provide the ZIP/audio bytes or complete HTML in this session. The available file-search action had no materialize/download action, and the runtime had no mounted input files. This does **not** establish that the files are absent from the user's Library.

The source excerpts identify `rinne-three-worlds-150-v2`, `productionStatus: audition`, `commercialClearance: false` and `licenseStatus: review-required`. The single HTML embeds only nine previews; the full 150-track audio directory is needed for HTTP playback. Do not reconstruct music, catalog records or source UI code from search snippets. Actual input access is required to finish the requested task.

The TimGM6mb notice was checked against Debian's primary copyright record. It lists TimGM6mb.sf2 under GPL-2 and describes mixed sample provenance. This is not an independent determination of the rendered tracks' redistribution obligations or commercial clearance. Keep clearance unresolved; obtain and review the source package's complete provenance/licence evidence before public distribution, including DEV. No SoundFont file is copied by these tools.

Primary references checked 2026-09-11:
- Debian TimGM6mb copyright: https://metadata.ftp-master.debian.org/changelogs/main/t/timgm6mb-soundfont/timgm6mb-soundfont_1.3-5_copyright
- FFmpeg command/decoding documentation: https://ffmpeg.org/ffmpeg.html
- Repository flow: `AGENTS.md`, `docs/DEVELOPMENT.md`, `docs/INTEGRATION.md`, `docs/MONOREPO.md` at the base SHA above.

## Completion path — do not mark Ready before this is done

1. Materialize the actual source ZIP/UI and original provenance. Select the extracted directory containing the catalog's `audio/` and `midi/` paths. Review the full original code and schema; do not relax checks or fabricate missing fields to force a pass.
2. Import the genuine inputs using the tool below. Run full original-asset quality checks, including lossless/Ogg evidence as applicable, and investigate warnings/listening concerns. The importer does not extract ZIP archives and never needs a ZIP in the end-user browser.
3. Integrate the source player/UI with package-owned assets and explicit workspace exports/dependencies, preserving `catalogVersion`/`catalog` compatibility and existing game audio. Implement a ZIP-free HTTP entry using the current monorepo relative-base/build pattern. Choose its final route only against the actual current app structure; this Draft makes no public URL claim. Avoid copying 150 decoded tracks or preload requests into all three game boot paths.
4. Verify all 150 HTTP audio routes and decoder/play starts, multiple loop crossings, transitions/gain fades, rapid selection/cancellation, pause/seek/retry/error handling, favourites/notes import-export, direct deep links, narrow portrait UI and game return navigation. Measure transfer size, transient decode and retained buffers separately (the source's 64 MiB cache statement is not total browser memory). Verify licence notices and distribution disposition; do not classify unresolved music as Production-ready.
5. Reconcile with latest develop, run the normal affected fast gate, report actual results and change this PR to Ready only when implementation is complete. Then existing Integration owns merge, final regression, DEV publication and public real-browser confirmation. Do not manually merge, dispatch deployment or modify main/Production in this implementation WORK.

Example for a developer after obtaining the real files (paths are explicit inputs, not claims that those files exist):

```sh
node packages/audio/tools/import-bgm150.mjs \
  --root /path/to/materialized-source \
  --studio Rinne_BGM_150_Studio.html \
  --evidence ORIGINAL_LICENSE_NOTICE.md \
  --output /path/to/new-verified-import
node packages/audio/tools/audit-bgm150.mjs \
  --root /path/to/new-verified-import \
  --report /path/to/new-audio-audit.json
node --test packages/audio/tests/bgm150-import.test.mjs
```

The audit requires installed `ffmpeg` and `ffprobe`. The fast unit tests require only Node built-ins; no new npm dependency or CI install step is needed.

Depends-On: none. **External blocker: actual Library source bytes. Keep Draft; do not auto-integrate this unfinished task.**
