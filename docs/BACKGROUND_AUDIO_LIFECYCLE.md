# Background audio lifecycle

Applies to `rinne`, `village`, and `demon` browser apps.

## Acceptance contract

- Browser autoplay policy is isolated in `@soul/platform-web/audio-activation`; game code subscribes to the shared first-user-gesture gate instead of installing its own one-off unlock listeners.
- Audio contexts that need first-gesture permission must be created/resumed synchronously from that gate before any network/decode await that could consume transient user activation.
- When the document becomes hidden or is leaving the page, browser-backed BGM must stop and relinquish its active media source so Android/browser OS media controls cannot restart it while the game is backgrounded.
- Web Audio contexts must remain suspended while hidden and must not be reawakened by game events.
- Returning to the foreground may resume only audio that the player had already started or unlocked. No new autoplay is introduced.
- The shared music library must preserve the selected track and playback intent across the foreground transition while keeping the media element source detached in the background.
- `rinne` gameplay BGM follows the same source-detach contract because it uses an `HTMLAudioElement` outside the shared music library.
- In-app stop/dispose still clears playback intent and releases media resources.

## Focused validation

Run lifecycle regression tests for the shared music library and Rinne gameplay audio, then build all three affected apps from the exact work head in the repository-hosted validation runner.
