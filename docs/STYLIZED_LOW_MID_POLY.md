# Stylized Low / Mid Poly Visual Direction

## Goal

Move the current visual direction toward a deliberate **Stylized Low / Mid Poly** language that is easier to read, animate, scale across the shared world, and run on mobile without making the game look cheaper.

The target is not "low quality because it is low poly". The target is **simple geometry, strong silhouettes, controlled color blocks, good motion, lighting, VFX, and lived-in environmental density**.

## Why this direction

The repository now serves multiple game surfaces from a shared world and shared packages. The visual system therefore needs to support:

- reusable character and world assets across `apps/village`, `apps/rinne`, and `apps/demon`
- mobile-friendly rendering budgets
- large NPC/enemy populations and future multiplayer scenarios
- reliable animation and equipment attachment
- fast visual QA and AI-assisted iteration
- progressive LOD without changing the core art identity

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

### World density

Do not spend the geometry budget on invisible building detail. Use readable, reusable dressing:

- signs and banners
- barrels, crates, fences, benches and tools
- grass, flowers, stones and leaf clusters
- road variation and decals
- laundry/cloth and smoke
- lanterns and warm windows

The world should feel inhabited even when the base architecture is geometrically simple.

## Vertical visual target

This change must first prove the direction with a small cross-game slice rather than replacing every asset at once.

### Shino / named-character target

- use the hero Mid Poly profile
- preserve recognisable identity at front, three-quarter and side views
- consolidate hair into readable masses
- prioritise clean shoulder/arm deformation and natural weapon grip
- keep clothing shapes broad and animation-safe
- avoid decorative noise around wrists, waist and knees

### Village target

- use Low Poly architecture and prop profiles
- improve depth using foreground/midground/background grouping
- keep Cool Ambient x Warm Local lighting
- use set dressing and ground breakup instead of excessive geometry
- leave headroom for NPC density and multiplayer characters

### Enemy target

- use Low Poly geometry with an immediately readable threat silhouette
- communicate horror through posture, mouth/hand proportions and animation rather than surface noise
- make approach, anticipation, hit and feeding/growth beats visually distinct

## Motion quality gates

Simpler geometry exposes poor motion more clearly, so the following are art-quality requirements, not optional polish:

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

The stylized profiles should make LOD, instancing, material reuse, and reduced segment counts explicit implementation tools rather than emergency optimizations.

## Scope of the first implementation

This PR will:

1. add shared art-profile data for hero, NPC, enemy, environment, prop, and distant roles
2. expose the profile data from the shared character/rendering source where appropriate
3. wire the current named-character baseline to the hero profile
4. apply a first visual-target pass to the current village and enemy/gameplay surfaces without replacing binary master assets
5. add automated assertions for the profile budgets and identity rules where practical
6. keep the three apps compatible with the shared-world architecture

## Non-goals

- no blanket decimation of every existing GLB
- no destructive replacement of source master assets from a consumer app
- no Production/main deployment
- no removal of the current motion-quality or visual-review pipelines
- no move to unlit/flat-shaded graphics solely for performance
- no one-off art fork per app

## Acceptance

The first pass is acceptable when:

- the shared profile is executable data rather than documentation only
- Shino/named-character usage resolves to the hero profile
- village/world rendering can consume the environment/prop profile
- enemy rendering can consume the enemy profile
- code paths preserve existing gameplay contracts
- fast repository validation passes before the PR becomes Ready for review

Future asset-generation and visual-QA work should use this document and the shared profile as the visual source of truth.