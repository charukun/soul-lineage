# Stylized Low / Mid Poly Visual Direction

## Goal

Move the current visual direction toward a deliberate **Stylized Low / Mid Poly** language that is easier to read, animate, scale across the shared world, and run on mobile without making the game look cheaper.

The target is not "low quality because it is low poly". The target is **simple geometry, strong silhouettes, controlled color blocks, good motion, lighting, VFX, and lived-in environmental density**.

## Why this direction

The repository serves multiple game surfaces from a shared world and shared packages. The visual system therefore needs to support reusable character/world assets, mobile-friendly rendering budgets, large NPC/enemy populations, future multiplayer, reliable animation/equipment attachment, fast visual QA, AI-assisted iteration and progressive LOD without changing the core art identity.

## Visual hierarchy

| Asset class | Target | Primary source of quality |
| --- | --- | --- |
| Hero / named character | Stylized Mid Poly | silhouette, face readability, hair massing, motion, materials |
| General NPC | Stylized Low-Mid Poly | body/face/hair variation, color blocks, readable clothing |
| Enemy / mob | Stylized Low Poly | silhouette, posture, motion, hit/eat VFX |
| Buildings / props | Stylized Low Poly | large forms, material grouping, set dressing, lighting |
| Distant/background assets | Aggressive Low Poly / LOD | color, silhouette, atmosphere |

## Shared visual language

### Geometry

- Prefer clear large forms over dense micro-detail.
- Avoid detail that disappears at normal gameplay camera distance.
- Use geometry where it affects silhouette, deformation, collision readability, or lighting.
- Prefer texture/material/color separation for small surface information.
- Keep joint areas clean enough for shoulder, elbow, wrist, hip, knee, and ankle motion.
- Never runtime-decimate skinned/morphed character geometry just to hit a number.

### Character identity

Character variation should be driven in this order:

1. silhouette and body proportions
2. face shape and hair massing
3. large clothing pieces
4. palette and material blocks
5. a small number of distinctive accessories

Do not create diversity by stacking tiny accessories onto the same base body.

### Lighting and materials

Keep the established **Cool Ambient x Warm Local** idea.

- cool ambient/environment contribution
- warm lantern, fire, window, spell, and interaction light
- stylized PBR rather than flat unlit surfaces
- restrained AO and fog to separate planes
- preserve clear player/interactable silhouettes

All shared surfaces use `packages/characters/src/material-library.js` tokens. The default `surface.*` tokens preserve authored base colors while normalising roughness/metalness across apps. Palette-bearing tokens such as `wood.oak.weathered`, `metal.iron`, `cloth.linen.dark`, `skin.warm01`, `foliage.green`, and `light.warm` are available for newly authored shared assets.

### World density

Do not spend the geometry budget on invisible building detail. Use readable, reusable dressing: signs, banners, barrels, crates, fences, benches, tools, vegetation, road breakup, decals, cloth, smoke, lanterns and warm windows.

The shared art profile exposes distance-based density weights. Near keeps the full dressing target, mid keeps the readable large dressing, and far keeps only silhouette-critical elements. This is a render/presentation policy, never a gameplay-state policy.

## Runtime LOD policy

The first real runtime LOD deliberately avoids destructive asset conversion.

- Hero/NPC skinned meshes keep their authored geometry. Character reduction must use authored LOD assets later, not runtime triangle deletion.
- Static environment/prop meshes can install a distance LOD that preserves the same Object3D, transform, material, picking identity and collision path.
- Near renders the authored geometry.
- Far swaps only the render geometry to a local bounding-box proxy when the mesh is complex enough.
- Very flat terrain, instanced meshes, morph targets and skinned meshes are excluded.
- LOD thresholds come from the shared role profile.

This gives a real triangle reduction path for world density now while preserving safe upgrade paths to authored LOD1/LOD2 meshes later.

## Multiplayer presentation budget

The common-world policy is distance-aware:

- local player: Hero profile regardless of distance calculation
- nearby remote player: Hero presentation
- mid-distance remote player: NPC/Low-Mid presentation
- far remote player: Distant presentation
- nearby enemy: Enemy profile
- far enemy: Distant presentation

This policy only chooses visual cost. Authority, hit detection, simulation and network state remain unchanged.

## VFX budget

VFX remains one of the primary sources of perceived quality when geometry is simplified. Every art profile includes an effects scale, particle ceiling and trail-segment budget. Hero and enemy presentation keep the strongest hit/feed/growth readability; population and distant roles progressively reduce cost. Apps expose the profile VFX budget rather than inventing independent per-app quality tiers.

## Character Workshop / Visual QA

Character Workshop is the visual quality control surface, not a separate modelling-only page.

The Quality QA panel now combines Motion QA with **Art / Performance QA**:

- selected role/profile
- triangles versus soft role budget
- material count versus soft role budget
- shared material-token coverage
- runtime LOD coverage
- current FPS / draw calls
- actual geometry silhouette envelope for front, side and three-quarter readability
- cohort silhouette similarity comparison

Silhouette metrics sample current static/skinned vertex positions and derive front/side/diagonal envelopes plus height bands. They are useful automatic warnings, not a substitute for human visual approval.

## Shino / named-character gate

Shino remains the Hero Mid Poly reference. The quality gate prioritises:

- recognisable front/three-quarter/side silhouette
- readable hair massing
- face readability at normal gameplay distance
- clean shoulder/arm deformation
- natural weapon grip
- broad animation-safe clothing shapes
- no accidental downgrade from population material sharing

Hero materials are isolated from the shared NPC pool so NPC cost tuning cannot silently overwrite Shino.

## Motion quality gates

Simpler geometry exposes poor motion more clearly, so the following remain art-quality requirements:

- believable center of mass
- stable foot contact
- natural shoulder/elbow/wrist lines
- plausible weapon grip and carry posture
- readable anticipation and follow-through
- living idle motion without excessive noise
- no obvious body/weapon/clothing interpenetration at gameplay camera distance

## Performance intent

Targets remain:

- desktop: 60 fps class target
- Pixel Fold class mobile: 30 fps class target

Shared profiles include soft triangle/material/draw-call budgets. They are QA review thresholds, not destructive runtime clamps. LOD, instancing, shared materials and reduced authored segment counts are the preferred optimisation tools.

## Non-goals

- no blanket decimation of every existing GLB/VRM
- no destructive replacement of source master assets from a consumer app
- no Production/main deployment
- no removal of the current Motion Quality or Visual Review pipelines
- no move to unlit/flat-shaded graphics solely for performance
- no one-off art fork per app
- no gameplay/network state changes hidden inside visual LOD

## Acceptance

The visual direction is implementation-complete for this phase when:

- the shared profile is executable data rather than documentation only
- Shino/named-character usage resolves to the Hero profile without pooled-material cross-talk
- village/world rendering consumes environment/prop profiles and real static-geometry LOD
- enemy rendering consumes the Enemy profile and shared VFX budget
- shared material tokens are assigned by the rendering adapter
- multiplayer/density presentation policy is portable shared data
- Character Workshop reports art budgets, silhouette metrics and cohort similarity alongside Motion QA
- automated tests cover profiles, material tokens, LOD switching, silhouette comparison and QA integration
- gameplay, collision, serialization and animation contracts stay intact
- fast repository validation passes before Ready for review

Future asset-generation and visual-QA work should use this document and the shared profile/material libraries as the visual source of truth.
