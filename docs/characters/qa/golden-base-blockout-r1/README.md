# Golden Base blockout comparison (rejected)

Source: actual user-supplied Golden Base turnaround. Generated: pinned img2threejs SDF factory at `be387859d60630d1e8c9e30397277bc2d3e88456`.

Hosted evidence: https://github.com/charukun/soul-lineage/actions/runs/35831119869

| View | Reference vs render | Silhouette IoU | Required |
| --- | --- | ---: | ---: |
| Front | [front-comparison.png](front-comparison.png) | 0.4899 | 0.85 |
| Side | [side-comparison.png](side-comparison.png) | 0.4746 | 0.85 |
| Back | [back-comparison.png](back-comparison.png) | 0.564 | 0.85 |

These PNGs are hash-matched to `scripts/character-forge/fixtures/golden-base-v1/blockout-r1-observation.json`. All three fail upstream Tier-1; no visual approval, finished package, or rig result is implied. Side source shows a lowered arm while Front/Back show arms wide.
