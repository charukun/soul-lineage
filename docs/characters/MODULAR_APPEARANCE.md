# MasterCharacter modular appearance v1

`Sendagaya_Shino` remains the audited humanoid MasterCharacter and animation/collision reference. Modular appearance is an opt-in presentation layer; it does not change character stats, hitboxes, world simulation, inventory, save authority or network authority.

## Slots

The portable `@soul/characters` contract exposes five independently selectable visual slots:

- `face`: classic / round / sharp / long
- `hair`: original / bob / crop / tail
- `body`: balanced / slender / sturdy / compact
- `outfit`: uniform / tunic / mantle / apron
- `accessory`: none / glasses / headband / scarf

`appearancePartsForSeed(seed)` creates a deterministic combination. `appearancePartsForCharacter(character)` derives a stable appearance from the existing character seed without changing the canonical character record. `nextAppearanceParts(character, generation)` provides deterministic alternate looks for review/authoring. Manual slot overrides are validated and fail closed.

## Rendering policy

`@soul/rendering/master-character-modular` decorates an already-spawned MasterCharacter actor. It wraps the actor's presentation sample only.

- Face variation is non-destructive head proportion scaling.
- Body variation is presentation-only root silhouette scaling; gameplay collision remains game-owned.
- Original Shino hair is retained for `original`. The three alternate hairstyles hide only the source hair material and attach low-cost stylized hair geometry to the head bone.
- Shino's source body is not a guaranteed complete nude body under its uniform. Therefore alternate outfits never remove the source complete outfit. Tunic, mantle and apron are additional complete-coverage overlays attached to the existing humanoid rig.
- Accessories attach to head/spine bones and reuse the actor's current appearance colors.
- Source geometry/textures remain shared. Modular overlay geometry is low-poly and actor-local state remains isolated.

This v1 is a production architecture and initial authored kit, not a claim that these four hairstyles/garments are the final art library. New authored assets can replace a slot implementation without changing the portable slot IDs or gameplay contracts.

## Review UI

The main MasterCharacter review gains a `見た目` mode. A reviewer can edit all five slots for the selected actor, generate a deterministic alternate appearance, cycle alternate patterns, apply generated appearances to the visible cohort, compare 12/30 actors, and reset selected/all actors back to the standard Shino presentation.

The 3D stage remains visible while the control pane scrolls independently. Advanced seed/gene/session diagnostics remain on the separate advanced page.

## Acceptance boundaries

The existing audited Shino asset, source/license chain, expressions and spring-bone adapter remain unchanged. No main/Production changes are included. Browser smoke must prove that the simulator loads without page/console/network errors and the modular review controls can be reached. Final visual art approval and Pixel Fold device-performance acceptance remain human/device review gates after DEV publication.
