import * as THREE from 'three';
import { createWorkshopMotionQA } from './character-motion-qa.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { appearanceForCharacter, auditShinoDocument, crowdPlan, PoseSchedule, GENES, YEAR_MS } from '@soul/characters';
import { createShinoProductionPool, shinoProductionRigFromGLTF } from '@soul/rendering/master-character-production';
import { reviewSettings, createReviewCohort, editReviewCharacter, serializeReviewSession, deserializeReviewSession,
  reviewGlbDocument, MAX_MODEL_BYTES, MAX_SESSION_BYTES } from './character-review-state.js';

const el = id => document.getElementById(id);
const review = { ready: false, errors: [], actors: [], records: [], pool: null, version: THREE.REVISION, sample: null, measure: null };
window.masterCharacterReview = review;
const status = (message, isError = false) => { el('status').textContent = message; el('status').dataset.error = String(isError); };
const report = error => { const message = String(error?.message ?? error); review.errors.push(message); if (review.errors.length > 100) review.errors.shift(); status(`エラー: ${message}`, true); };
const download = (blob, name) => {
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function disposeTemplate(root) {
  if (!root) return;
  const geometry = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set(), images = new Set();
  root.traverse(node => {
    if (!node.isMesh) return; geometry.add(node.geometry); if (node.skeleton) skeletons.add(node.skeleton);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) if (material) {
      materials.add(material); for (const value of Object.values(material)) if (value?.isTexture) { textures.add(value); if (value.image?.close) images.add(value.image); }
    }
  });
  geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
  skeletons.forEach(s => s.dispose()); images.forEach(i => i.close());
}
async function defaultBytes() {
  const response = await fetch(new URL('./simulator/assets/SHINO_review.vrm', location.href), { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`モデル取得 HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > MAX_MODEL_BYTES) throw new Error('モデルが大きすぎます');
  if (!response.body) return response.arrayBuffer();
  const reader = response.body.getReader(), chunks = []; let length = 0;
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength;
      if (length > MAX_MODEL_BYTES) throw new Error('モデルが大きすぎます'); chunks.push(value); }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}

function start() {
  const canvas = el('stage'), renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  renderer.debug.onShaderError = () => { throw new Error('モデルのシェーダーをコンパイルできませんでした'); };
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, .01, 120);
  const orbit = new OrbitControls(camera, canvas); orbit.enableDamping = true; orbit.minDistance = .18; orbit.maxDistance = 45;
  orbit.maxPolarAngle = Math.PI * .49; orbit.target.set(0, 1, 0);
  scene.add(new THREE.HemisphereLight('#fff6df', '#557481', 2.4));
  const sun = new THREE.DirectionalLight('#ffdeb0', 3); sun.position.set(-5, 9, 8); scene.add(sun);
  const fill = new THREE.DirectionalLight('#8cd6ec', 2); fill.position.set(8, 5, -8); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ color: '#2f4549', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.008; scene.add(ground);
  const marker = new THREE.Mesh(new THREE.RingGeometry(.48, .51, 48), new THREE.MeshBasicMaterial({ color: '#dcc493', side: THREE.DoubleSide }));
  marker.rotation.x = -Math.PI / 2; marker.position.y = .004; scene.add(marker);
  let settings = reviewSettings(), records = createReviewCohort(settings), actors = [], schedules = [], appearances = [];
  let pool = null, template = null, loading = false, retry = defaultBytes, alive = true, frameId = 0;
  let elapsed = 0, last = performance.now(), warmup = 60, frames = [], lastMetrics = 0, physicsActors = 0, drawnActors = 0;
  let motionQA = null;
  const events = new AbortController(), on = (target, type, handler) => target.addEventListener(type, handler, { signal: events.signal });
  const guard = handler => event => { try { handler(event); } catch (error) { report(error); syncUI(); } };
  function resetMeasure() { warmup = 60; frames = []; lastMetrics = 0; }
  function measure() {
    const sorted = [...frames].sort((a, b) => a - b), percentile = q => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? null;
    return { three: THREE.REVISION, sampleCount: frames.length, medianMs: percentile(.5), p95Ms: percentile(.95),
      fps: frames.length ? 1000 * frames.length / frames.reduce((a, b) => a + b, 0) : null,
      info: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures },
      pool: pool?.stats() ?? null, drawnActors, physicsActors, physicsMode: settings.springs, hardwareAcceptance: 'not-measured' };
  }
  review.measure = measure;
  function syncUI() {
    const mapping = { seed: 'seed', count: 'count', age: 'age', ages: 'ages', outfit: 'outfit', ancestry: 'ancestry', view: 'view',
      motion: 'motion', expression: 'expression', expressionMode: 'expression-mode', expressionWeight: 'expression-weight', springs: 'springs', background: 'background' };
    if (![...el('count').options].some(o => Number(o.value) === settings.count)) el('count').add(new Option(`${settings.count}体`, String(settings.count)));
    for (const [key, id] of Object.entries(mapping)) el(id).value = String(settings[key]);
    for (const key of ['blink', 'rotate']) el(key).checked = settings[key];
    for (const option of el('count').options) option.disabled = Number(option.value) > records.length;
    el('age-label').value = `${settings.age}歳`; el('expression-label').value = `${Math.round(settings.expressionWeight * 100)}%`;
    el('pause').textContent = settings.paused ? '再生' : '一時停止'; el('pause').setAttribute('aria-pressed', String(settings.paused));
    el('selected').replaceChildren(...records.slice(0, settings.count).map((r, i) => new Option(`${String(i + 1).padStart(2, '0')} · ${r.ageMs / YEAR_MS}歳`, String(i))));
    el('selected').value = String(settings.selected);
    const record = records[settings.selected];
    for (const gene of GENES) el(`gene-${gene}`).value = String((record.genome[gene][0] + record.genome[gene][1]) / 131070);
    el('identity').textContent = `${record.id}\nseed ${record.seed} / revision ${record.revision}\n${record.ageMs / YEAR_MS}歳 / ${record.lifeState}\n${record.outfitId}\n親: ${record.parents.join(', ') || 'なし'}`;
    el('subject').textContent = `個体 ${settings.selected + 1} / ${settings.count} · ${record.ageMs / YEAR_MS}歳`;
    review.settings = { ...settings }; review.records = records;
    window.dispatchEvent(new Event('character-review-change'));
  }
  function background() {
    const color = { slate: '#1e3036', white: '#ffffff', black: '#000000' }[settings.background];
    scene.background = new THREE.Color(color); ground.material.color.set(settings.background === 'slate' ? '#2f4549' : color);
  }
  function arrange() {
    const columns = Math.ceil(Math.sqrt(settings.count)), rows = Math.ceil(settings.count / columns);
    actors.forEach((actor, i) => {
      actor.setVisible(settings.view === 'crowd' || i === settings.selected);
      actor.root.position.set(settings.view === 'single' ? 0 : (i % columns - (columns - 1) / 2) * 2.1, 0,
        settings.view === 'single' ? 0 : (Math.floor(i / columns) - (rows - 1) / 2) * 2.3);
      actor.root.rotation.y = settings.rotate ? elapsed * .22 : 0; actor.resetSecondary();
    });
    updateMarker();
  }
  function updateMarker() {
    const actor = actors[settings.selected]; marker.visible = Boolean(actor?.root.visible);
    if (actor) { marker.position.x = actor.root.position.x; marker.position.z = actor.root.position.z; }
  }
  function aim(preset = 'overview') {
    if (motionQA?.active) { motionQA.aim(preset === 'side' ? 'left' : ['front','back'].includes(preset) ? preset : 'front'); return; }
    const actor = actors[settings.selected]; if (!actor) return;
    let target, distance;
    orbit.maxDistance = ['village','demon'].includes(preset) ? 120 : 45;
    camera.fov = preset === 'demon' ? 42 : 38;
    camera.updateProjectionMatrix();
    if (preset === 'village') {
      // Match MURAAAAAAA's normal 46m vertical span in perspective, without changing the game camera.
      distance = 46 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      camera.position.set(distance * .28, distance * .62, distance * .74);
      orbit.target.set(0,.85,0); camera.lookAt(orbit.target); orbit.update(); resetMeasure(); return;
    }
    if (preset === 'demon') {
      const zoom = canvas.clientWidth / canvas.clientHeight > 1.3 ? 15 : 19;
      camera.position.set(Math.sin(.33)*zoom*.88, zoom, Math.cos(.33)*zoom*.88);
      orbit.target.set(0,.1,-2.6); camera.lookAt(orbit.target); orbit.update(); resetMeasure(); return;
    }
    if (preset === 'overview' && settings.view === 'crowd' && settings.count > 1) {
      const columns = Math.ceil(Math.sqrt(settings.count)), rows = Math.ceil(settings.count / columns);
      const width = (columns-1)*2.1+2.6, depth = (rows-1)*2.3+2, height = 3;
      target = new THREE.Vector3(0, 1.15, 0);
      const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov/2)), elevation = .48;
      distance = Math.max(width/(2*tangent*camera.aspect), (height*Math.cos(elevation)+depth*Math.sin(elevation))/(2*tangent)) + depth*.5;
      distance = Math.max(6,distance)*1.12; orbit.maxDistance = Math.max(45,distance*1.2);
      camera.position.copy(target).add(new THREE.Vector3(0, Math.sin(elevation)*distance, Math.cos(elevation)*distance)); orbit.target.copy(target);
    } else {
      const look = appearances[settings.selected], height = look.adultHeightMetres * look.scale * look.height;
      actor.root.updateWorldMatrix(true, true);
      target = preset === 'face' ? actor.bones.head.getWorldPosition(new THREE.Vector3()) : actor.root.position.clone().add(new THREE.Vector3(0, height * .52, 0));
      distance = preset === 'face' ? Math.max(.36, height * .5) : height * 1.65 / Math.min(1, camera.aspect);
      const sign = preset === 'back' ? -1 : 1;
      camera.position.copy(target).add(new THREE.Vector3(preset === 'side' ? distance : 0, preset === 'face' ? 0 : height * .08, preset === 'side' ? 0 : sign * distance));
      orbit.target.copy(target);
    }
    camera.lookAt(orbit.target); orbit.update(); resetMeasure();
  }
  function resize() {
    const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); if (motionQA?.active) motionQA.aim(motionQA.camera); resetMeasure();
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  const axis = new THREE.Vector3(0, 0, 1), pitch = new THREE.Vector3(1, 0, 0), quaternion = new THREE.Quaternion();
  function pose(bones, t) {
    bones.leftUpperArm.quaternion.multiply(quaternion.setFromAxisAngle(axis, -1.25));
    bones.rightUpperArm.quaternion.multiply(quaternion.setFromAxisAngle(axis, 1.25));
    for (const side of ['left', 'right']) bones[`${side}LowerArm`].quaternion.multiply(quaternion.setFromAxisAngle(pitch, -.15));
    bones.spine.quaternion.multiply(quaternion.setFromAxisAngle(axis, Math.sin(t * 1.4) * .016));
    if (settings.motion === 'walk') {
      const stride = Math.sin(t * 4) * .4;
      bones.leftUpperLeg.quaternion.multiply(quaternion.setFromAxisAngle(pitch, stride));
      bones.rightUpperLeg.quaternion.multiply(quaternion.setFromAxisAngle(pitch, -stride));
      bones.leftLowerLeg.quaternion.multiply(quaternion.setFromAxisAngle(pitch, Math.max(0, -stride) * 1.4));
      bones.rightLowerLeg.quaternion.multiply(quaternion.setFromAxisAngle(pitch, Math.max(0, stride) * 1.4));
    }
  }
  function applyExpressions(actor, i) {
    const names = actor.expressionNames, weights = {}, category = /^(blink|look|aa$|ih$|ou$|ee$|oh$)/;
    let name = settings.expression;
    if (settings.expressionMode === 'mixed') { const emotions = names.filter(n => !category.test(n) && n !== 'neutral'); name = emotions.length ? emotions[i % emotions.length] : ''; }
    if (name && names.includes(name) && (settings.expressionMode !== 'selected' || i === settings.selected)) weights[name] = settings.expressionWeight;
    if (settings.blink && names.includes('blink')) {
      const phase = (elapsed + i * .37) % (3.1 + i % 3 * .27), blink = phase < .2 ? Math.sin(Math.PI * phase / .2) : 0;
      weights.blink = Math.max(weights.blink ?? 0, blink);
    }
    actor.setExpressions(weights);
  }
  function refreshLooks() {
    appearances = records.slice(0, settings.count).map(appearanceForCharacter);
    actors.forEach((actor, i) => { actor.sample(appearances[i], elapsed + i * .19, motionQA?.pose(actor) ?? (settings.motion === 'rest' ? null : pose)); motionQA?.finish(actor, i); applyExpressions(actor, i); });
    syncUI(); resetMeasure();
  }
  function rebuild() {
    if (!pool) { syncUI(); return; }
    actors.forEach(actor => pool.despawn(actor.id)); actors = []; schedules = [];
    for (const record of records.slice(0, settings.count)) { const actor = pool.spawn(record.id); scene.add(actor.root, actor.attachments); actors.push(actor); schedules.push(new PoseSchedule()); }
    review.actors = actors; refreshLooks(); arrange(); aim();
  }
  function update(patch, action = 'looks') {
    const next = reviewSettings({ ...settings, ...patch });
    if (next.count > records.length) throw new Error('個体数が足りません。「生成」で新しい30個体を作成してください');
    settings = next;
    if (action === 'rebuild') rebuild(); else if (action === 'arrange') { arrange(); aim(); syncUI(); }
    else refreshLooks();
    background();
  }
  async function load(getBytes) {
    if (loading || !alive) return; loading = true; retry = getBytes; review.ready = false; el('retry').disabled = true; el('progress').value = .1;
    status('モデル取得・ハッシュと利用条件を確認中…'); let nextTemplate = null, nextPool = null, installed = false;
    try {
      const bytes = await getBytes(); if (!alive) return;
      const json = reviewGlbDocument(bytes), hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
      const audit = auditShinoDocument(json, hash); if (!audit.approved) throw new Error(`モデル監査不合格: ${audit.errors.join(', ')}`);
      status('モデル・表情・揺れ物の準備中…'); el('progress').value = .4;
      const gltf = await new GLTFLoader().parseAsync(bytes, ''); nextTemplate = gltf.scene;
      const rig = await shinoProductionRigFromGLTF(gltf); if (!alive) return;
      nextPool = createShinoProductionPool({ template: nextTemplate, rig });
      // Check every required actor before replacing a working pool.
      const preflight = records.slice(0, settings.count).map(record => nextPool.spawn(record.id)); preflight.forEach(a => nextPool.despawn(a.id));
      pool?.dispose(); disposeTemplate(template); actors = []; pool = nextPool; template = nextTemplate; nextPool = null; nextTemplate = null;
      installed = true; review.pool = pool; review.audit = audit; const capabilities = pool.diagnostics(); review.capabilities = capabilities;
      el('expression').replaceChildren(new Option('ニュートラル', ''), ...capabilities.expressionNames.map(name => new Option(name, name)));
      if (!capabilities.expressionNames.includes(settings.expression)) settings.expression = '';
      el('capabilities').textContent = `SHA-256 ${hash}\n表情 ${capabilities.expressionNames.length}種\n揺れ ${capabilities.springChains}チェーン / ${capabilities.springJoints}関節\n${capabilities.warnings.join('\n') || 'PBR・モーフ・標準球/カプセル衝突の範囲で表示'}`;
      rebuild(); el('progress').value = .8; renderer.compile(scene, camera); renderer.render(scene, camera);
      review.ready = true; el('progress').value = 1; status('監査済みモデルを表示中。個体差・表情・揺れ・共有状態を検査できます。');
    } catch (error) { review.ready = !installed && Boolean(pool); retry = defaultBytes; report(error); }
    finally { nextPool?.dispose(); disposeTemplate(nextTemplate); loading = false; el('retry').disabled = !alive; window.dispatchEvent(new Event('character-review-change')); }
  }
  for (const id of ['view', 'count']) on(el(id), 'change', guard(() => update({ [id]: id === 'count' ? Number(el(id).value) : el(id).value }, id === 'count' ? 'rebuild' : 'arrange')));
  function regenerate() { settings = reviewSettings({ ...settings, seed: Number(el('seed').value) }); records = createReviewCohort(settings); rebuild(); }
  on(el('regenerate'), 'click', guard(regenerate));
  on(el('next-seed'), 'click', guard(() => { el('seed').value = String((settings.seed + 30) >>> 0); regenerate(); }));
  on(el('ancestry'), 'change', guard(() => { settings = reviewSettings({ ...settings, ancestry: el('ancestry').value }); regenerate(); }));
  function ageOrOutfit(id) {
    const patch = id === 'age' ? { age: Number(el('age').value), ages: 'fixed' } : { [id]: el(id).value };
    settings = reviewSettings({ ...settings, ...patch });
    // Age/dye edits preserve individual genomes. Regenerate is the only cohort reset.
    const target = createReviewCohort(settings);
    records = records.map((record, i) => editReviewCharacter(record, id === 'outfit' ? { outfit: target[i].outfitId.split('.')[2] } : { age: target[i].ageMs / YEAR_MS }));
    refreshLooks();
  }
  for (const id of ['age', 'ages', 'outfit']) on(el(id), id === 'age' ? 'input' : 'change', guard(() => ageOrOutfit(id)));
  function select(index) { update({ selected: (index + settings.count) % settings.count }, 'arrange'); }
  on(el('selected'), 'change', guard(() => select(Number(el('selected').value))));
  on(el('previous'), 'click', guard(() => select(settings.selected - 1))); on(el('next'), 'click', guard(() => select(settings.selected + 1)));
  for (const [id, key] of Object.entries({ motion: 'motion', expression: 'expression', 'expression-mode': 'expressionMode', springs: 'springs', background: 'background' }))
    on(el(id), 'change', guard(() => update({ [key]: el(id).value })));
  on(el('expression-weight'), 'input', guard(() => update({ expressionWeight: Number(el('expression-weight').value) })));
  for (const id of ['blink', 'rotate']) on(el(id), 'change', guard(() => update({ [id]: el(id).checked }, id === 'rotate' ? 'arrange' : 'looks')));
  on(el('pause'), 'click', guard(() => { update({ paused: !settings.paused }); last = performance.now(); }));
  for (const gene of GENES) on(el(`gene-${gene}`), 'input', guard(() => {
    records[settings.selected] = editReviewCharacter(records[settings.selected], { [gene]: Number(el(`gene-${gene}`).value) }); refreshLooks();
  }));
  for (const button of document.querySelectorAll('[data-camera]')) on(button, 'click', guard(() => aim(button.dataset.camera)));
  on(el('measure'), 'click', resetMeasure);
  on(el('retry'), 'click', () => { void load(retry); });
  on(el('file'), 'change', () => { const file = el('file').files[0]; if (!file) return;
    if (file.size > MAX_MODEL_BYTES) report(new Error('モデルが大きすぎます')); else void load(() => file.arrayBuffer()); el('file').value = ''; });
  on(el('export'), 'click', guard(() => download(new Blob([serializeReviewSession({ settings, records, note: el('note').value, metrics: measure() })], { type: 'application/json' }), `shino-review-${settings.seed}.json`)));
  let importSequence = 0;
  on(el('session-file'), 'change', async () => {
    const file = el('session-file').files[0], sequence = ++importSequence; if (!file) return;
    try {
      if (file.size > MAX_SESSION_BYTES) throw new Error('検査データが大きすぎます');
      const next = deserializeReviewSession(await file.text()); if (!alive || sequence !== importSequence) return;
      if (pool && next.settings.expression && !pool.diagnostics().expressionNames.includes(next.settings.expression)) throw new Error('このモデルに存在しない表情です');
      settings = next.settings; records = next.records; el('note').value = next.note; elapsed = 0; rebuild(); background();
      status('検査データを読み込みました。保存時の性能値は合格証明として引き継ぎません。');
    } catch (error) { report(error); } finally { el('session-file').value = ''; }
  });
  on(el('capture'), 'click', guard(() => {
    if (!review.ready) throw new Error('モデル読込後に保存してください'); renderer.render(scene, camera);
    canvas.toBlob(blob => { if (blob) download(blob, `shino-${settings.seed}-${settings.selected + 1}.png`); else report(new Error('画像を作成できませんでした')); }, 'image/png');
  }));
  function suspend() { last = performance.now(); resetMeasure(); actors.forEach(a => a.resetSecondary()); }
  on(document, 'visibilitychange', suspend);
  on(canvas, 'webglcontextlost', event => { event.preventDefault(); review.ready = false; report(new Error('GPU接続が失われました。復旧後に再試行してください')); });
  on(canvas, 'webglcontextrestored', () => { void load(retry); });
  function frame(now) {
    if (!alive) return; frameId = requestAnimationFrame(frame);
    const actual = (now - last) / 1000; last = now;
    if (document.hidden || !review.ready) return;
    try {
      const dt = Math.min(.1, Math.max(0, actual)); if (!settings.paused) elapsed += dt; if (!motionQA?.active) orbit.update(); motionQA?.tick(dt); physicsActors = 0; drawnActors = 0;
      const plan = new Map(crowdPlan(actors.map((a, i) => ({ id: a.id, visible: a.root.visible, important: i === settings.selected, distance: a.root.position.distanceTo(camera.position) }))).map(p => [p.id, p]));
      actors.forEach((actor, i) => {
        const policy = plan.get(actor.id); if (actor.root.visible) drawnActors++;
        if (!settings.paused) {
          if (schedules[i].advance(dt, policy.animationHz) !== null) { actor.sample(appearances[i], elapsed + i * .19, motionQA?.pose(actor) ?? (settings.motion === 'rest' ? null : pose)); motionQA?.finish(actor, i); }
          if (settings.rotate) actor.root.rotation.y = elapsed * .22;
          if (policy.visible) applyExpressions(actor, i);
        }
        const enabled = policy.visible && (settings.springs === 'all' || settings.springs === 'auto' && policy.springBones);
        if (enabled && actor.secondaryJointCount) physicsActors++;
        if (!settings.paused) actor.updateSecondary(dt, enabled && !motionQA?.active);
      });
      renderer.render(scene, camera);
      if (!settings.paused && Number.isFinite(actual) && actual > 0) { if (warmup > 0) warmup--; else { frames.push(actual * 1000); if (frames.length > 600) frames.shift(); } }
      if (now - lastMetrics > 500) {
        lastMetrics = now; const m = measure();
        el('metrics').textContent = `${m.drawnActors}体表示 / Pool ${m.pool.active}体\n共有Geometry ${m.pool.geometries} / Texture ${m.pool.textures}\n揺れ更新 ${settings.paused ? '停止中' : `${m.physicsActors}体`} (${settings.springs})\nDraw calls ${m.info.calls} / ${m.info.triangles.toLocaleString()} triangles\n${m.fps?.toFixed(1) ?? '未計測'} FPS / 中央値 ${m.medianMs?.toFixed(1) ?? '-'} ms\np95 ${m.p95Ms?.toFixed(1) ?? '-'} ms / ${m.sampleCount} frames`;
      }
    } catch (error) { review.ready = false; report(error); }
  }
  review.sample = age => { settings = reviewSettings({ ...settings, age, ages: 'fixed' }); records = records.map(r => editReviewCharacter(r, { age })); refreshLooks(); };
  // Explicit inspection API. Never touches game saves, inventories or network authority.
  review.session = () => serializeReviewSession({ settings, records, note: el('note').value });
  review.restore = text => {
    const next = deserializeReviewSession(text);
    if (pool && next.settings.expression && !pool.diagnostics().expressionNames.includes(next.settings.expression)) throw new Error('このモデルに存在しない表情です');
    settings = next.settings; records = next.records; el('note').value = next.note;
    rebuild(); background();
  };
  review.editSelected = changes => {
    records[settings.selected] = editReviewCharacter(records[settings.selected], changes);
    if (changes.age !== undefined) settings.ages = 'mixed';
    refreshLooks();
  };
  review.configure = patch => update(patch, patch.count !== undefined ? 'rebuild' : patch.view !== undefined || patch.selected !== undefined ? 'arrange' : 'looks');
  review.refresh = refreshLooks;
  review.aim = aim;
  motionQA = createWorkshopMotionQA({ review, scene, camera, orbit, canvas, refresh: refreshLooks, draw: () => renderer.render(scene, camera) });
  review.motionQA = motionQA;
  function dispose() {
    if (!alive) return; alive = false; review.ready = false; cancelAnimationFrame(frameId); events.abort(); observer.disconnect(); orbit.dispose();
    motionQA?.dispose(); pool?.dispose(); disposeTemplate(template); ground.geometry.dispose(); ground.material.dispose(); marker.geometry.dispose(); marker.material.dispose(); renderer.dispose();
  }
  on(window, 'pagehide', event => { if (!event.persisted) dispose(); else suspend(); });
  on(window, 'pageshow', suspend); syncUI(); background(); frameId = requestAnimationFrame(frame); void load(defaultBytes);
}
try { start(); } catch (error) { report(error); el('retry').disabled = false; el('retry').onclick = () => location.reload(); }

if (document.body.classList.contains('advanced-review')) import('./character-workspace-advanced.js').catch(report);
