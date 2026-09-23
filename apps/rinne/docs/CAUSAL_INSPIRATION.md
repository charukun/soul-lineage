# 因縁閃き / Causal inspiration

## Approved direction (2026-09-19)

閃きは、人生で抱えた問題に、現在の身体・得物・意識が新しい答えを出し、本人の型として残る現象。経験値・使用回数・瀕死抽選・レアリティによる解放ではない。

This user-approved redesign supersedes the prohibition on all history-derived character learning in COMBAT_EVOLUTION.md. It does not authorize damage farming, permanent injury bonuses, invulnerability, altered hit geometry, or bypassing simulation/resource constraints. Existing saves, input, rest, age/equipment rules and the Tidebreak contact authority remain supported.

## Implementation acceptance

- Keep 心 / 体 as bounded authored semantics, and generate 技 / 変 as one-to-three-stage techniques from a deterministic grammar. 序・破・急 are equip slots for these learned techniques, not separate learned 連 records. Old 連 records remain readable for save compatibility but are no longer discovered. Motion role, footwork, weapon, spacing and execution compatibility define the structural technique; authored techniques remain golden reference cases, not the ceiling of the technique space.
- 心得 may carry bounded faith weights keyed by the same canonical attributes used by techniques and VFX. Learned 心 records aggregate that faith over the life; stronger faith raises the chance that a newly realized 技/変 receives the matching presentation attribute. The attribute is stored separately from the technique ID, so VFX-only differences never become new techniques.
- Authored/review VFX expose canonical elemental `attributes` metadata. Gameplay may promote an explicitly curated, pinned same-origin effect for a supported attribute; presentation attributes never invent elemental damage, resistance, hit authority or contact.
- Record bounded meaningful life/observation/combat traces; repeated identical situations do not accumulate unlock currency.
- Resolve 問い → 兆し → contextual opportunity → first performed answer → 定着. A prospective answer must be physically feasible and available in the real combat executor before it is recorded as a performed combat insight.
- Use equipment, age, actual injury/stamina, continuous intention and bounded inherited motifs as different inputs. Crisis is not required and cannot mint resources or negate a hit.
- Preserve evidence explaining why a discovery belongs to this person. No fabricated ancestor memories or provenance.
- Transmit body tendencies and compressed motifs, not learned technique IDs; preserve observation/teaching provenance separately from ancestry. Bound active memory and inheritance across long play.
- Keep authored motion/contact semantics and presentation independent. The grammar may combine only executable authored motion parts whose sequence is physically admissible; speed, mirror, VFX, attributes or scalar damage never mint a new structural technique.
- Generated technique IDs must reconstruct the same structure deterministically after save/load. The runtime resolves generated IDs through the shared grammar, and the combat review uses that same grammar rather than a separate review-only naming system.
- Grammar v2 expands each executable motion with bounded authored footwork alternatives, explicit entry distance bands, range deltas, and entry/exit posture. Guard and ready are valid setup/recovery parts; unsupported fake motions such as a non-executable feint are not invented. Existing gen1 generated IDs remain resolvable for save compatibility while new discoveries use gen2 structural IDs.
- Technique naming is derived from normalized structure. Similar structural families may intentionally share a martial archetype name such as 三段突き instead of minting a unique label for every footwork variant.
- Generated techniques may receive a deterministic life-specific signature name at realization. Most stay on the martial archetype; a bounded minority branch into stylized Japanese or katakana naming such as 龍牙穿 or ドラゴンドライブ. The life seed and inherited/current technique motifs influence this branch, so two lives may name the same structure differently while the structural technique ID stays identical.
- Attributes and status traits remain presentation/state layers and never rename a technique by themselves. A rule-changing trait promotes the naming grammar to 秘技; a singular rule-changing trait with an explicit unlock condition promotes it to 奥義.
- 秘技 / 奥義 are not age locks or rarity loot. Generated rule-changing traits use a deterministic lifetime-mastery profile composed from age maturity, stabilized techniques, distinct use contexts, lineage strength, continuity with inherited motifs, and adaptation to bodily change. The curve rises sharply through adulthood and especially after roughly 40–45, while preserving a very small young-genius path.
- A generated rule trait must change executable behavior. The current adaptive rule may reroute blocked retreat/side space when an alternate lane exists; the singular rule can ignore that space constraint. Cosmetic/status-only traits never qualify.
- An 奥義 realized at age 17 or younger grants the persistent personal tag 天賦の才 and emits village-scoped news with community roles for mentor, training partner, and future co-op ally.
- Birth may also deterministically reveal a much rarer congenital ギフテッド trait. It is separate from the earned 天賦の才 tag. A gifted birth emits village-scoped news and exposes a social hook so other players/systems can recognize the child as someone to protect, mentor, or later recruit for co-op.
- Refresh in-game technique/journal/lineage presentation: readable situations, signs, purpose, provenance, dormant/usable status and renaming, not an unlock checklist.
- Distinguish 技演出レビュー (motion/VFX/SFX/contact presentation) from 閃き検証 (causal simulation). Review fixtures do not mutate a player's save.
- Include deterministic focused tests for distinct lives, repetition resistance, injury/age/equipment constraints, real execution, save migration, lineage and bounded storage, plus the existing browser evidence route.

## Presentation contract

- A 兆し becomes visibly present only when separate evidence has connected into a plausible answer. Current weapon, age, injury, stamina and required executor can keep that answer from being ready without exposing an unlock recipe.
- When a question first becomes ready during play, its own sentence may surface briefly above the character and drift away. It is an in-world thought, not a permanent HUD objective.
- First successful realization remains 会得. Repeating the learned answer across distinct contexts can make it 定着; that transition is a separate event and may be announced as 「身体に馴染んだ」.
- The technique journal may compose a short causal sentence only from saved provenance. It must not invent unseen ancestors, events or motives.
- 技演出レビュー may reproduce the 兆し → 閃き presentation for inspection, but remains review-only and does not mutate gameplay learning or save data.

## Validation and delivery

GitHub Connector authoring on the dedicated branch; reconcile latest develop, validate the exact head through Astra Work Validation, check freshness, Ready then merge to develop. DEV publication starts asynchronously; main/Production and quality gates remain unchanged.

## Provisional tuning

Discovery cadence, stabilization diversity, active family count, motif depth and brief presentation durations are named tunables, not claims of play-balanced completion. Broader content expansion, complete parenting simulation and new externally sourced media are not silently simulated as completed features.
