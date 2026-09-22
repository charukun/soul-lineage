import * as THREE from 'three';
import { createCameraDirector } from '@soul/rendering/camera-director';
import { CHARACTER_VIEWS, resolveCharacterView, viewYaw } from '@soul/rendering/character-view-resolver';
import { applyCameraPresentation, actorScreenSafety, actorSilhouetteSamples } from '@soul/rendering/camera-presentation-three';
import { combatCameraFrame } from '@soul/rendering/combat-camera-frame';
import { createForegroundOcclusionFader } from '@soul/rendering/occlusion';
const $ = id => document.getElementById(id), canvas = $('camera-stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x152320); scene.fog = new THREE.Fog(0x152320, 24, 60);
const camera = new THREE.PerspectiveCamera(40, 1, .08, 120), director = createCameraDirector(), fader = createForegroundOcclusionFader();
scene.add(new THREE.HemisphereLight(0xa5c8d0, 0x514633, 2.1)); const sun = new THREE.DirectionalLight(0xffddb3, 3); sun.position.set(-5, 10, 5); sun.castShadow = true; scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x526655, roughness: .95 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const grid = new THREE.GridHelper(36, 36, 0x819778, 0x667c65); grid.position.y = .005; scene.add(grid);
const resources = [];
function mesh(root, geometry, color, x, y, z) { const material = new THREE.MeshStandardMaterial({ color, roughness: .65 }); resources.push(geometry, material); const object = new THREE.Mesh(geometry, material); object.position.set(x, y, z); object.castShadow = true; root.add(object); return object; }
function dummy(color, x, z) {
  const root = new THREE.Group(); root.position.set(x, 0, z); scene.add(root);
  mesh(root, new THREE.CapsuleGeometry(.29, .6, 4, 10), color, 0, 1, 0);
  mesh(root, new THREE.SphereGeometry(.26, 12, 10), 0xe1bf96, 0, 1.72, 0);
  mesh(root, new THREE.BoxGeometry(.11, .07, .04), 0x2d3938, -.11, 1.75, .23); mesh(root, new THREE.BoxGeometry(.11, .07, .04), 0x2d3938, .11, 1.75, .23);
  const limbs = []; for (const x of [-.16, .16]) limbs.push(mesh(root, new THREE.CapsuleGeometry(.105, .48, 4, 8), 0x3b4140, x, .38, 0));
  for (const x of [-.37, .37]) mesh(root, new THREE.CapsuleGeometry(.09, .48, 4, 8), color, x, 1, .05);
  const hand = new THREE.Group(); hand.position.set(-.43, .9, .16); root.add(hand);
  const sword = new THREE.Group(); hand.add(sword); mesh(sword, new THREE.BoxGeometry(.1, 1.0, .05), 0xd6dddd, 0, .5, 0); mesh(sword, new THREE.BoxGeometry(.36, .06, .1), 0xc0a361, 0, .05, 0);
  const spear = new THREE.Group(); hand.add(spear); mesh(spear, new THREE.CylinderGeometry(.025, .025, 2, 8), 0x967b50, 0, .6, 0); mesh(spear, new THREE.ConeGeometry(.085, .3, 6), 0xcad6d6, 0, 1.72, 0); spear.visible = false;
  const shield = mesh(root, new THREE.CylinderGeometry(.32, .32, .09, 12), 0xb7a476, .43, 1, .24); shield.rotation.x = Math.PI / 2;
  return { root, limbs, hand, sword, spear, shield };
}
const hero = dummy(0x97b5ab, -1.3, 0), enemy = dummy(0xa87670, 1.3, 1.1); enemy.root.rotation.y = Math.PI;
const occluders = new THREE.Group(); scene.add(occluders); const wall = mesh(occluders, new THREE.BoxGeometry(2.5, 3, .35), 0x8a8070, .5, 1.5, 3); occluders.visible = false;
for (let i = 0; i < CHARACTER_VIEWS.length; i++) {
  const view = CHARACTER_VIEWS[i], button = document.createElement('button'); button.type = 'button'; button.textContent = view; button.dataset.view = view; button.setAttribute('aria-pressed', 'false');
  button.onclick = () => { $('shot').value = 'exploration'; $('camera-yaw').value = String(viewYaw(view) * 180 / Math.PI + Number($('actor-yaw').value)); }; $('view-grid').append(button);
}
let viewState = null, now = performance.now(), time = 0, infoTime = 0, raf, cycleStart = null, frameSnapshot = null;
$('profile').onchange = () => director.setProfile($('profile').value);
$('transition-cycle').onclick = () => { cycleStart = time; };
const resize = new ResizeObserver(() => { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); }); resize.observe(canvas);
function animate(t) {
  const dt = Math.min(.05, Math.max(0, (t - now) / 1000)); now = t; time += dt;
  if (cycleStart !== null) { const index = Math.floor((time - cycleStart) / 2); $('shot').value = ['exploration', 'combat', 'conversation', 'interior', 'exploration'][Math.min(4, index)]; if (index >= 4) cycleStart = null; }
  const size = Number($('actor-size').value); hero.root.scale.setScalar(size); hero.root.rotation.y = Number($('actor-yaw').value) * Math.PI / 180;
  const motion = $('motion').checked; hero.limbs.forEach((limb, i) => limb.rotation.x = motion ? Math.sin(time * 6 + i * Math.PI) * .3 : 0); hero.hand.rotation.x = motion ? Math.sin(time * 3) * .7 : 0;
  const spear = $('weapon').value === 'spear'; hero.spear.visible = spear; hero.sword.visible = !spear; hero.shield.visible = !spear;
  const actor = { id: 'hero', position: { x: hero.root.position.x, y: 0, z: 0 }, yaw: hero.root.rotation.y, height: 2 * size, radius: .5 * size, weaponRadius: (spear ? 1.8 : 1.1) * size };
  const target = { id: 'target', position: { x: enemy.root.position.x, y: 0, z: enemy.root.position.z }, yaw: Math.PI, height: 2, radius: .5, weaponRadius: 1.1 };
  const mode = $('shot').value, yaw = Number($('camera-yaw').value) * Math.PI / 180;
  const authoredShot = ['title', 'event'].includes(mode) ? { position: { x: Math.sin(time * .2) * 12, y: 5, z: Math.cos(time * .2) * 12 }, lookTarget: { x: 0, y: 1, z: 0 }, fov: mode === 'title' ? 35 : 38 } : null;
  const shot = director.update({ mode, actor, target, yaw, aspect: camera.aspect, offset: { x: 6, y: 4.5, z: 8 }, interiorPolicy: $('interior-policy').value, authoredShot,
    combatFrame: mode === 'combat' ? combatCameraFrame({ player: actor.position, threats: [target.position] }) : null }, dt);
  applyCameraPresentation(camera, shot);
  viewState = resolveCharacterView({ cameraPosition: camera.position, actorPosition: actor.position, actorYaw: actor.yaw, state: viewState, dt });
  occluders.visible = $('occluder').checked; const occlusion = fader.update({ camera, targets: actorSilhouetteSamples(actor), occluderRoot: occluders, enabled: occluders.visible, dt });
  const safety = actorScreenSafety(camera, [actor, target], occlusion.occludedRatio);
  frameSnapshot = { camera: shot, view: viewState, safety, occlusion, actor, target, model: '3d-dummy' };
  renderer.render(scene, camera); canvas.dataset.ready = 'true'; canvas.dataset.mode = shot.mode; canvas.dataset.view = viewState.currentView;
  if (time - infoTime > .1) {
    infoTime = time; $('view-label').textContent = viewState.currentView; $('shot-label').textContent = `${shot.mode} · ${shot.profile}`;
    for (const button of $('view-grid').children) button.setAttribute('aria-pressed', String(button.dataset.view === viewState.currentView));
    $('camera-metrics').textContent = `FOV ${shot.fov.toFixed(1)}° · 高さ ${(safety.actors[0].screenHeight * 100).toFixed(1)}% · 端の余白 ${(safety.actors[0].edgeMargin * 100).toFixed(1)}% · 重なり ${((safety.overlaps[0]?.ratio || 0) * 100).toFixed(1)}% · 遮蔽サンプル ${(occlusion.occludedRatio * 100).toFixed(0)}% · 遷移 ${(shot.transition.progress * 100).toFixed(0)}%`;
    $('camera-state').textContent = JSON.stringify(frameSnapshot, null, 2);
  }
  raf = requestAnimationFrame(animate);
}
canvas.cameraPresentation = () => structuredClone(frameSnapshot);
try { const info = typeof __BUILD_INFO__ !== 'undefined' ? __BUILD_INFO__ : {}; document.querySelector('[data-build]').textContent = String(info.commit || '').slice(0, 12); } catch {}
raf = requestAnimationFrame(animate);
window.addEventListener('pagehide', () => { cancelAnimationFrame(raf); resize.disconnect(); fader.dispose(); for (const resource of resources) resource.dispose(); ground.geometry.dispose(); ground.material.dispose(); grid.geometry.dispose(); grid.material.dispose(); renderer.dispose(); }, { once: true });
