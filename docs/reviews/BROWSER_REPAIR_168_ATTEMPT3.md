# Browser Repair #168 — Attempt 3

## Source evidence

- Scope: develop browser self-healing Issue #168
- Baseline: `383f1fcd57e54836a2527122aaaacbc723a4f40e`
- Failing run: `34799035254`
- Evidence artifact: `dev-browser-383f1fcd57e54836a2527122aaaacbc723a4f40e`
- Automatic attempt: 3 / 3

The latest focused DEV browser run passed 9 of 10 tests. The only failure is Rinne music playback after audio playback itself has already succeeded. The shared music Stop button resolves in the DOM, but Rinne's no-scroll title menu places it on the semantic `再生・音量` page and marks it `data-page-away` while another book page is active. The browser gate currently tries to click that hidden real control directly and times out.

## Repair acceptance

The repair must use Rinne's existing page-book UI to select the real `再生・音量` page before the native Stop click. It must preserve the existing assertions that playback advances, media readiness is sufficient, no media error exists, stopping really pauses the audio, and the dialog remains closable through its real UI.

The repair must not use force click, direct product-state mutation, hidden-attribute removal, timeout expansion, retry around the browser assertion, request-failure suppression, assertion deletion, or changes to main / Production.

After the focused PR browser gate succeeds, normal Integration must merge the repair into develop and re-run the develop delivery/browser gate before Issue #168 is considered resolved.