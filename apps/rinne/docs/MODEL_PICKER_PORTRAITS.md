# Visual Review Lab model picker portraits

The public model picker is for choosing visually distinct review targets, not for exposing every internal preset alias.

## Public picker contract

- Every visible model card must show a portrait that represents that model identity. Do not reuse another character's portrait as a fallback.
- Presets that point to the same underlying character asset and only change scale/body proportions may remain addressable internally, but only the canonical identity is shown in the main picker.
- Remote portraits must be pinned to an immutable source revision. A failed portrait load uses a neutral fallback label, never another character's face.
- Motion Library characters use their pinned upstream rendered samples when available. A visual variant without a distinct representative portrait may remain internally selectable while staying out of the main picker.
- Review-only BLOCKOUT candidates may appear when they have an explicit representative reference image and are clearly labeled as BLOCKOUT.

## Acceptance

For the current Lab this means the main picker shows one canonical Shino card rather than repeating the same Shino face for body-scale aliases, and the visible KayKit Motion Library cards use their own pinned sample portraits instead of a generic 3D badge or a Shino fallback. Rogue Hooded remains available as an internal preset but is not duplicated in the main picker until it has a distinct approved portrait.
