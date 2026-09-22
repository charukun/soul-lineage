# RINNE Camera Presentation

`Game State → shot policy → shared transition → PerspectiveCamera → Character View Resolver`.

The rendering package is independent of Character25D, game movement and save formats. RINNE's `presentation-camera.js` supplies actual 3D bounds and legacy combat frames; `renderer.js` retains scenery, title sky/lighting, weapons and character runtime. No GLB or 3D actor has been removed. No additional HUD is installed.

## API / profiles

`createCameraDirector({profile:'current3d'})` returns `update(input,dt)`, `snapshot()`, `setProfile(name)`, `registerShot(mode,policy)` and `reset()`. Input supplies an actor (`id,position,yaw,height,focusHeight,radius,weaponRadius`), optional target, aspect, offset/yaw, mode, screen-safety measurements and authored shot. `space` identifies the coordinate system, not a camera mode.

Output includes mode, position, lookTarget, orbital yaw/pitch/distance, fov, targetActor/focusActors, continuousCameraYaw, presentationYaw, transition, safeViewRange and screenSafety. Pure math uses radians, Y up, +Z forward. All profiles remain perspective. `current3d` is the default (40° outdoors); distance compensates the previous 43° lens so silhouettes do not shrink merely because FOV changes. `hybrid25dReady` starts at 34° and is opt-in. Near/far distance control and actual-camera-relative movement remain intact. Right-button drag and Alt+Left/Right orbit; Alt+Home restores the original bearing. Primary swipe/tap/keyboard movement is unchanged.

Default modes: exploration, combat, conversation, interior, title, event/cinematic. `registerShot` supports boss/cutscene/review without renderer conditionals. Free yaw is default; softSnap and hardSnap are explicit optional policies. Outdoor pitch stays within 20–46°; long weapons, large creatures and narrow viewports can expand distance using subject bounds rather than a fixed human height.

## Transitions / interior / title

One damped orbit center, independently damped look target, exponential radius/pitch/FOV interpolation and shortest-path yaw serve every mode. Yaw velocity is bounded (4 rad/s, 8 for the authored title). Initial construction seeds a pose; subsequent mode switches do not copy the desired camera. The old cinematic title key path remains an authored shot input, with its own lighting/sky outside the director.

RINNE interiors use a local coordinate system. On space changes the old pose and look point are translated by the player's coordinate-origin delta, preserving the subject-relative pose, then morph to the new composition. This coordinate rebase is explicit in `transition.rebased`; numerical world coordinates necessarily change but are not interpreted as a long pan across unrelated worlds.

Current default is interiorFirstPerson, eye height derived from measured bounds. The eye is damped in position rather than orbited around its forward target while turning. interiorThirdPerson, interiorCutaway and interiorDiorama are available policies, not full room-remodelling systems. Conversation is opt-in through `view.presentationCamera.setShot({mode:'conversation',target:...})`; `setShot(null)` returns to game-state selection. The game does not yet trigger conversations automatically. Event/cinematic callers can pass authored position/lookTarget/fov the same way.

## Character25D connection

`resolveCharacterView({cameraPosition,actorPosition,actorYaw,state,dt,actionState})` is a pure reducer. It produces relativeYaw, currentView, previousView, nextView, transitionProgress. Eight anatomical directions are supported; left is +X for this repository's +Z-forward rig. Each direction owns its ±22.5° sector plus 2° dead zone and 5° hysteresis; near-zero camera distance and optional `actionState.lockView` preserve ownership. Crossfade metadata spans .16 s, but no 3D material is switched.

A future Character25D appearance driver consumes this state, not the Camera Director. `character25DAppearanceRequest(state)` maps it onto existing front/frontQuarter/side/backQuarter/back slots plus side metadata. It never mirrors asymmetric art; the runtime must resolve unavailable side art under its own provenance/fallback contract. The current five-slot Character25D actor's existing resolver is not silently replaced in this camera-only rollout. RINNE `setSubjectProvider(fn)` can supply 2.5D bounds and optional world-space `silhouetteSamples` without changing the director.

## Visibility and monsters

`actorScreenSafety` measures projected height, edge margins, in-front state and pair overlap (viewport fractions). The director accepts those measurements and already fits subjects/weapon radii to lens/aspect. Measurements are not yet an autonomous collision-avoiding camera solver. Humanoids, quadrupeds, floating, winged, blob and large actors use the same dimensional interface; no species-specific height is embedded in camera math.

Foreground fading samples feet/body/head (at most eight rays), supports several building/prop/wall roots, and returns sampled occludedRatio. This ratio measures blocked sample rays, not pixel-perfect alpha coverage. Existing alpha-hash material isolation/restoration remains. Encounter-only mesh proxies fade hit forest instances while preserving neighbouring instances and original matrices; the batch is never faded wholesale. At most 64 encountered instance parts may be proxied simultaneously. Scene geometry remains shared and is not disposed by the fader.

## Review / evidence

Visual Review Lab: `/review-camera`. Shared Director, pure view resolver, 3D dummies with sword/shield/spear, six modes, interior policies, actor scale/yaw, lens profiles, occluder and transition cycle. The five-column view grid remains five columns on phones. This page is not a replacement for RINNE gameplay evidence.

Read-only `canvas.cameraPresentation()` snapshots support browser evidence without adding a game HUD or state-injection endpoint. The isolated specialist workflow lives only on the task's dispatch branch and is not part of Fast DEV/Production. It compensates for the Chat environment's lack of full repository assets/browser and can be detached after this task. Formal merge-owning checks use the existing exact-head heavy runner; browser fixtures use native controls on immutable checked-out builds, not mutable DEV URLs.
