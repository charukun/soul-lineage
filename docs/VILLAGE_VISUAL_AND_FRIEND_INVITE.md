# Village visual language and friend invite contract

## Goal

Reuse the strongest village rendering techniques across the independent apps without making their art direction identical, and remove real-player villages from normal demon-army target selection.

## Visual contract

- Keep each app's palette, time of day and gameplay identity.
- Reuse presentation techniques rather than importing another app: ACES tone mapping, layered ambient/key/fill lighting, fog depth, restrained material grading, emissive/local light accents, contact grounding and small-scale terrain variation.
- Shared renderer helpers belong in `packages/rendering`; apps must not import another app.
- Demon rendering is the visual reference and should not regress while techniques are extracted.
- Village consumes the shared daytime preset and adds a restrained atmospheric depth layer. Rinne/Lanternfell keeps its static Three.js adapter and receives the same visual language through its moonlit fog/light/bloom stack plus a restrained screen-space atmosphere layer.

## Real-player village contract

- A real player's village is never listed as a normal raid target and there is no always-visible online-raid button in the demon app.
- A friend visit is explicit, invite-only and non-hostile. It grants no raid reward, memory unlock, visit ledger completion or combat advantage.
- The village owner must deliberately create an invitation. The guest only sees a visit entry point when an invitation payload is present.
- Existing WebRTC offer/answer transport may be reused, but player-facing copy must describe a friend visit rather than an online raid.
- Invalid or expired invitations fail closed and never expose a generic real-player-village browser.
- The transport remains peer-to-peer; this task does not add a public village directory or matchmaking service.
- Only the village exterior presentation snapshot is shared with the guest. News, progression, raid ledger and room contents stay local.

## Acceptance

- Demon normal UI contains no selectable real-player-village target.
- Opening the demon app presents no friend-village or real-player-village control.
- A valid friend invitation opens the dedicated Village friend-visit page and creates a non-hostile sightseeing session.
- Village app can deliberately issue/copy an invitation and accept the guest response using the existing peer transport.
- Village and Rinne/Lanternfell each receive a concrete adaptation of the shared visual language without cross-app imports.
- Fast tests cover hidden/default behavior, invitation parsing, privacy boundaries, non-hostile role semantics and visual-language wiring.
