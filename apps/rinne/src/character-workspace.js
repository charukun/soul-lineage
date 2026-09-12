import { BASE_APPEARANCE_PARTS, canonicalAppearanceParts, mergeAppearanceParts, nextAppearanceParts } from '@soul/characters';
import { attachModularAppearanceController } from '@soul/rendering/master-character-modular';
import { createReviewCohort, reviewSettings, serializeReviewSession } from './character-review-state.js';
import { WORKSPACE_KEY, serializeWorkspace, deserializeWorkspace, createEditHistory } from './character-workspace-state.js';

/** One isolated editor workspace shared by the simple and advanced pages. */
export function createCharacterWorkspace(review) {
  const profiles = new Map(), controllers = new WeakMap(), history = createEditHistory();
  let syncing = false, restoring = false, previewId = null, generation = 0, saveMessage = 'このブラウザに保存', timer;
  const selected = () => review.records[review.settings.selected];
  const profile = id => profiles.get(id) ?? BASE_APPEARANCE_PARTS;
  const snapshot = () => serializeWorkspace(review.session(), [...profiles].filter(([id]) => review.records.some(r => r.id === id)));
  const emit = () => window.dispatchEvent(new Event('character-workspace-change'));
  function save() {
    try { localStorage.setItem(WORKSPACE_KEY, snapshot()); saveMessage = 'このブラウザに保存済み'; }
    catch { saveMessage = '端末保存できません。データ保存を使用'; }
    emit();
  }
  function sync() {
    if (syncing || restoring) return;
    syncing = true;
    try {
      const ids = new Set(review.records.map(r => r.id));
      for (const id of profiles.keys()) if (!ids.has(id)) profiles.delete(id);
      let attached = false;
      for (const actor of review.actors) {
        let controller = controllers.get(actor);
        if (!controller) { controller = attachModularAppearanceController(actor); controllers.set(actor, controller); attached = true; }
        const next = actor.id === previewId ? BASE_APPEARANCE_PARTS : profile(actor.id);
        // Check the actual controller after pool recycling, not a stale signature cache.
        if (JSON.stringify(controller.profile) !== JSON.stringify(next)) controller.setProfile(next);
      }
      if (attached) review.refresh();
    } finally { syncing = false; }
    emit();
  }
  function install(text) {
    const document = deserializeWorkspace(text);
    restoring = true;
    try {
      review.restore(serializeReviewSession(document.session));
      profiles.clear(); document.parts.forEach(([id, p]) => profiles.set(id, p)); previewId = null;
    } finally { restoring = false; }
    sync(); review.refresh();
  }
  function perform(action) {
    if (!review.ready) return;
    previewId = null; const before = snapshot(); action(); sync();
    history.record(before, snapshot()); save();
  }
  const api = {
    history, snapshot, save,
    get saveMessage() { return saveMessage; },
    get selected() { return selected(); },
    get previewing() { return previewId !== null; },
    getProfile(id = selected().id) { return canonicalAppearanceParts(profile(id)); },
    change(slot, value) { perform(() => { const id = selected().id; profiles.set(id, mergeAppearanceParts(profile(id), { [slot]: value })); review.refresh(); }); },
    edit(changes) { perform(() => review.editSelected(changes)); },
    randomize() { perform(() => { generation = generation % 65535 + 1; profiles.set(selected().id, nextAppearanceParts(selected(), generation)); review.refresh(); }); },
    configure(patch) { previewId = null; review.configure(patch); sync(); },
    previewOriginal() { previewId = previewId ? null : selected().id; sync(); },
    undo() { const next = history.undo(snapshot()); if (next) { install(next); save(); } },
    redo() { const next = history.redo(snapshot()); if (next) { install(next); save(); } },
    import(text) { const next = deserializeWorkspace(text); perform(() => install(JSON.stringify(next))); },
    refresh: sync
  };
  let stored;
  try { stored = localStorage.getItem(WORKSPACE_KEY); } catch { saveMessage = '端末保存できません。データ保存を使用'; }
  try {
    if (stored) install(stored);
    else {
      const settings = reviewSettings({ view: 'single', ages: 'fixed', age: 22, outfit: 'original', count: 6 });
      review.restore(serializeReviewSession({ settings, records: createReviewCohort(settings) }));
    }
  } catch (error) { saveMessage = `保存データ読込不可: ${error.message}`; }
  window.addEventListener('character-review-change', () => {
    if (restoring || syncing) return;
    sync(); clearTimeout(timer); timer = setTimeout(save, 180);
  });
  window.addEventListener('pagehide', () => { clearTimeout(timer); save(); });
  // Finish navigation writes before pagehide can dispose the renderer.
  for (const link of document.querySelectorAll('a[href*="characters"]')) link.addEventListener('click', save);
  sync();
  return api;
}
export function downloadWorkspace(text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'shino-workspace.json';
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
