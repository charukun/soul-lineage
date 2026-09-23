# Golden Base pixel projection diagnostic (rejected geometry)

Hosted run https://github.com/charukun/soul-lineage/actions/runs/35835815212,
source head cb6375e308de52c09633f1f548b7e8dae0403a86, artifact 10739296010.
Screenshots show the head and suit torso only, with the calibrated 444:680
camera aspect ratio. Earlier screenshots in this folder used a 540:1080
canvas and visually squeezed the head; the images here replace them.

The source's mint eyes, eyebrows, small mouth, skin and gray suit were sampled
by actual camera projection into unique UV charts, with depth and component
ownership masks. The counts in the artifact refer to baked atlas texels and
include separately observed, mirrored, interpolated and inferred classes.
They are not unique source-image pixel counts.

This remains a failed diagnostic. Eyes extend over the cheeks, forehead and
back scalp have discontinuities, and the side suit has missing or contaminated
regions. Limbs were intentionally hidden. Camera calibration fitted manually
inferred 3D landmarks, not measured mesh feature reprojection. The earlier
silhouette IoU scores came from the wrong canvas aspect ratio and must be
recomputed; they cannot certify acceptance. No upstream pass or quality gate
was marked as passed. Fix the reference-to-generated-mesh landmark
correspondences and projection ownership, rerender all three views, then
recompute visual gates before rigging.
