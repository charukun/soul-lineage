# RINNE UI 6.0.0: approved storybook pages

## Scope

The four user-approved concept images in `ui-reference-v6/` are the visual reference. Their artwork is materialized in `apps/rinne/public/ui/storybook/`; `provenance.json` records source crops, hashes and byte lengths. Runtime requests use the app's own static assets, not third-party image URLs. The approved title screen and permanent 心 / 技 / 体 / 装 order are unchanged.

The reference images are not a replacement game specification. These pages use the existing game-state model and setters:

- 心: three active心得 slots, learned心得, nonmutating preview and actual consciousness-balance comparison.
- 技: 序 / 破 / 急 slots, existing combos and favored settings, known techniques and existing inspiration signs.
- 体: 構え / 戦法 / 残心, currently available forms and real body tendencies.
- 装: 武器 / 防具 / 盾, owned inventory, preview then confirmed equip through the existing permission callback.

The proposal's fictional skill names, accessory slot, equipment levels, rarity, durability values and numeric inspiration gauge are not implemented as invented game mechanics. Newborns do not receive adult equipment or learned skills merely because the mockup shows them.

## Recorded comparison work

Successful GitHub-hosted workbench run: https://github.com/charukun/soul-lineage/actions/runs/35670087272

Compared source: `d5addf7475e631288fd79a387bd60d3df92b3760`.
Evidence-only commit: `9834c96ef77eaee4adbc00d68a3ac01cc974e2fd`.

`ui-reference-v6/evidence/receipt.json` records 100 actual CSS-candidate / browser-render / image-comparison rounds: 25 for each page. 36 candidates were retained and 64 were reverted. Each record includes changed parameter values, before/after image hashes, measured geometry and loss, and a candidate CSS hash. The associated Actions artifact contains 200 before/after JPEGs plus initial/final PNGs.

The metric combines blurred reference-image error (55%) and normalized layout-anchor error (45%). These are automated layout-refinement rounds, not 100 independent manual redesigns, and the score is not a percentage claim of pixel identity.

The retained `evidence/proposed-calibration.css` is copied exactly into `apps/rinne/src/storybook-calibration.css`. The final merge-owning validation must check out the reconciled PR head and run both the model tests and `browser-storybook-acceptance.test.mjs`, plus the RINNE build.

## Browser acceptance boundary

The browser test uses the production menu composition with isolated adult/newborn state fixtures. It verifies canonical slot counts, persistent core buttons, materialized artwork, preview versus confirm, save-codec persistence, equipment confirmation, close/Escape cleanup, age/combat/shared-world gates, and small/landscape viewport bounds. It is not a no-injection full-life gameplay playthrough.

Closed pages must render no empty window. The storybook controller cleans up all visibility flags on close, Escape, lifecycle changes and disposal.

## Cleanup

The task-only workflow, upload receiver, comparison control files and authoring transport scripts are removed from the final branch tree. Historical commits and the recorded run preserve the comparison implementation; normal Actions workflows and quality gates are not expanded or weakened.
