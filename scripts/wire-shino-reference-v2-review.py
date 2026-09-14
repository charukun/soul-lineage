from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


review_path = Path('apps/rinne/src/character-review.js')
review = review_path.read_text(encoding='utf-8')
review = replace_once(
    review,
    "import { appearanceForCharacter, auditShinoDocument, crowdPlan, PoseSchedule, GENES, YEAR_MS } from '@soul/characters';",
    "import { appearanceForCharacter, auditCharacterRuntimeDocument, auditShinoDocument, crowdPlan, PoseSchedule, GENES, YEAR_MS } from '@soul/characters';",
    'runtime audit import',
)
old_fetch = """async function defaultBytes() {
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
}"""
new_fetch = """async function modelBytes(path) {
  const response = await fetch(new URL(path, location.href), { signal: AbortSignal.timeout(60000) });
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
const defaultBytes = () => modelBytes('./simulator/assets/SHINO_review.vrm');
async function referenceRuntimeSource(model) {
  const response = await fetch(new URL(model.integrityPath, location.href), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`DCC整合性情報取得 HTTP ${response.status}`);
  const integrity = await response.json();
  return Object.freeze({
    getBytes: () => modelBytes(model.assetPath),
    audit: (document, sha256, byteLength) => auditCharacterRuntimeDocument(document, sha256, byteLength, integrity)
  });
}"""
review = replace_once(review, old_fetch, new_fetch, 'generic model fetch')
review = replace_once(
    review,
    "let pool = null, template = null, loading = false, retry = defaultBytes, alive = true, frameId = 0;",
    "let pool = null, template = null, loading = false, retry = defaultBytes, retryAudit = auditShinoDocument, loadSequence = 0, modelRequestSequence = 0, alive = true, frameId = 0;",
    'load state',
)
review = replace_once(
    review,
    """  async function load(getBytes) {
    if (loading || !alive) return; loading = true; retry = getBytes; review.ready = false; el('retry').disabled = true; el('progress').value = .1;
    status('モデル取得・ハッシュと利用条件を確認中…'); let nextTemplate = null, nextPool = null, installed = false;
    try {
      const bytes = await getBytes(); if (!alive) return;
      const json = reviewGlbDocument(bytes), hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
      const audit = auditShinoDocument(json, hash); if (!audit.approved) throw new Error(`モデル監査不合格: ${audit.errors.join(', ')}`);""",
    """  async function load(getBytes, auditDocument = auditShinoDocument) {
    if (!alive) return; const sequence = ++loadSequence; loading = true; retry = getBytes; retryAudit = auditDocument; review.ready = false; el('retry').disabled = true; el('progress').value = .1;
    status('モデル取得・ハッシュと利用条件を確認中…'); let nextTemplate = null, nextPool = null, installed = false;
    try {
      const bytes = await getBytes(); if (!alive || sequence !== loadSequence) return;
      const json = reviewGlbDocument(bytes), hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
      const audit = auditDocument(json, hash, bytes.byteLength); if (!audit.approved) throw new Error(`モデル監査不合格: ${audit.errors.join(', ')}`);""",
    'load audit routing',
)
review = replace_once(
    review,
    "      const gltf = await new GLTFLoader().parseAsync(bytes, ''); nextTemplate = gltf.scene;\n      const rig = await shinoProductionRigFromGLTF(gltf); if (!alive) return;",
    "      const gltf = await new GLTFLoader().parseAsync(bytes, ''); nextTemplate = gltf.scene;\n      const rig = await shinoProductionRigFromGLTF(gltf); if (!alive || sequence !== loadSequence) return;",
    'stale model guard',
)
review = replace_once(
    review,
    "    } catch (error) { review.ready = !installed && Boolean(pool); retry = defaultBytes; report(error); }\n    finally { nextPool?.dispose(); disposeTemplate(nextTemplate); loading = false; el('retry').disabled = !alive; window.dispatchEvent(new Event('character-review-change')); }",
    "    } catch (error) { if (sequence === loadSequence) { review.ready = !installed && Boolean(pool); report(error); } }\n    finally { nextPool?.dispose(); disposeTemplate(nextTemplate); if (sequence === loadSequence) { loading = false; el('retry').disabled = !alive; window.dispatchEvent(new Event('character-review-change')); } }",
    'load completion guard',
)
review = replace_once(review, "on(el('retry'), 'click', () => { void load(retry); });", "on(el('retry'), 'click', () => { void load(retry, retryAudit); });", 'retry audit')
review = replace_once(review, "else void load(() => file.arrayBuffer()); el('file').value = ''; });", "else void load(() => file.arrayBuffer(), auditShinoDocument); el('file').value = ''; });", 'file audit')
review = replace_once(review, "on(canvas, 'webglcontextrestored', () => { void load(retry); });", "on(canvas, 'webglcontextrestored', () => { void load(retry, retryAudit); });", 'context restore audit')
review = replace_once(
    review,
    "  review.sample = age => { settings = reviewSettings({ ...settings, age, ages: 'fixed' }); records = records.map(r => editReviewCharacter(r, { age })); refreshLooks(); };",
    "  review.loadDefaultModel = () => { modelRequestSequence++; return load(defaultBytes, auditShinoDocument); };\n  review.loadReferenceModel = async model => {\n    const request = ++modelRequestSequence;\n    try {\n      if (!model?.assetPath || !model?.integrityPath) throw new Error('DCCモデルのassetPath / integrityPathがありません');\n      const source = await referenceRuntimeSource(model);\n      if (!alive || request !== modelRequestSequence) return;\n      return await load(source.getBytes, source.audit);\n    } catch (error) { if (request === modelRequestSequence) report(error); }\n  };\n  review.sample = age => { settings = reviewSettings({ ...settings, age, ages: 'fixed' }); records = records.map(r => editReviewCharacter(r, { age })); refreshLooks(); };",
    'review runtime API',
)
review_path.write_text(review, encoding='utf-8')

workspace_path = Path('apps/rinne/src/character-workspace.js')
workspace = workspace_path.read_text(encoding='utf-8')
workspace = replace_once(
    workspace,
    """      for (const actor of review.actors) {
        let controller = controllers.get(actor);
        if (!controller) { controller = attachModularAppearanceController(actor); controllers.set(actor, controller); attached = true; }
        const index = review.records.findIndex(r => r.id === actor.id);
        const selectedReference = referenceModel && actor.id === selectedId ? referenceModel : null;""",
    """      for (const actor of review.actors) {
        const index = review.records.findIndex(r => r.id === actor.id);
        const selectedReference = referenceModel && actor.id === selectedId ? referenceModel : null;
        if (selectedReference?.kind === 'dcc-character-model') continue;
        let controller = controllers.get(actor);
        if (!controller) { controller = attachModularAppearanceController(actor); controllers.set(actor, controller); attached = true; }""",
    'skip DCC modular overlay',
)
workspace = replace_once(
    workspace,
    "  const emit = () => window.dispatchEvent(new Event('character-workspace-change'));",
    "  const emit = () => window.dispatchEvent(new Event('character-workspace-change'));\n  function clearModelSelection() {\n    const previous = model(); modelId = null;\n    if (previous?.kind === 'dcc-character-model') void review.loadDefaultModel?.();\n  }",
    'clear DCC model helper',
)
workspace = replace_once(
    workspace,
    """    selectModel(id = null) {
      const next = id === null || id === '' ? null : characterReferenceModel(id).id;
      if (modelId === next) return;
      modelId = next; previewId = null; sync(); emit();
    },""",
    """    selectModel(id = null) {
      const next = id === null || id === '' ? null : characterReferenceModel(id).id;
      if (modelId === next) return;
      const previous = model(); modelId = next; previewId = null; const selectedModel = model();
      if (selectedModel?.kind === 'dcc-character-model') void review.loadReferenceModel?.(selectedModel);
      else if (previous?.kind === 'dcc-character-model') void review.loadDefaultModel?.();
      sync(); emit();
    },""",
    'DCC model loader',
)
workspace = replace_once(workspace, "      perform(() => { modelId = null; const settings = reviewSettings({ ...review.settings, seed, ancestry, selected: 0 });", "      perform(() => { clearModelSelection(); const settings = reviewSettings({ ...review.settings, seed, ancestry, selected: 0 });", 'generate clears DCC')
workspace = replace_once(workspace, "      perform(() => { const settings = reviewSettings({ ...review.settings, ages: age === 'mixed' ? 'mixed' : 'fixed', ...(age === 'mixed' ? {} : { age }) });", "      perform(() => { clearModelSelection(); const settings = reviewSettings({ ...review.settings, ages: age === 'mixed' ? 'mixed' : 'fixed', ...(age === 'mixed' ? {} : { age }) });", 'age clears DCC')
workspace = replace_once(workspace, "    change(slot, value) { perform(() => { modelId = null; const id = selected().id;", "    change(slot, value) { perform(() => { clearModelSelection(); const id = selected().id;", 'part clears DCC')
workspace = replace_once(workspace, "    edit(changes) { perform(() => review.editSelected(changes)); },", "    edit(changes) { perform(() => { clearModelSelection(); review.editSelected(changes); }); },", 'record edit clears DCC')
workspace = replace_once(workspace, "    randomize() { perform(() => { modelId = null; generation = generation % 65535 + 1;", "    randomize() { perform(() => { clearModelSelection(); generation = generation % 65535 + 1;", 'randomize clears DCC')
workspace = replace_once(workspace, "    previewOriginal() { modelId = null; previewId = previewId ? null : selected().id; sync(); },", "    previewOriginal() { clearModelSelection(); previewId = previewId ? null : selected().id; sync(); },", 'preview clears DCC')
workspace_path.write_text(workspace, encoding='utf-8')

test_path = Path('apps/rinne/tests/character-reference-model.test.mjs')
test_text = test_path.read_text(encoding='utf-8')
test_text = replace_once(
    test_text,
    "const workspace = readFileSync(new URL('../src/character-workspace.js', import.meta.url), 'utf8');",
    "const workspace = readFileSync(new URL('../src/character-workspace.js', import.meta.url), 'utf8');\nconst review = readFileSync(new URL('../src/character-review.js', import.meta.url), 'utf8');",
    'review source fixture',
)
test_text += """

test('DCC reference model loads its authored VRM through exact integrity audit', () => {
  assert.match(review, /auditCharacterRuntimeDocument/);
  assert.match(review, /referenceRuntimeSource/);
  assert.match(review, /loadReferenceModel/);
  assert.match(workspace, /loadReferenceModel/);
  assert.match(workspace, /loadDefaultModel/);
  assert.match(workspace, /selectedReference\?\.kind === 'dcc-character-model'/);
});
"""
test_path.write_text(test_text, encoding='utf-8')
