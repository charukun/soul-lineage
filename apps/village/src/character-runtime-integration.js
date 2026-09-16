import { VILLAGE_CHARACTER_RUNTIME, resolveVillageCharacterRuntime } from './character-runtime-adapter.js';

const village = typeof window === 'undefined' ? null : window.village;
const view = village?.view;

if (view && !view.__characterRuntimeIntegrated) {
  const originalSyncActor = view.syncActor.bind(view);
  view.syncActor = (person, time, monster = false) => {
    const result = originalSyncActor(person, time, monster);
    // Animals keep their native presentation path. The shared character adapter
    // is attached only to the procedural humanoid actor path.
    if (!person?.species || person.species === 'monster') {
      const node = view.actorNodes.get(person.id);
      if (node) {
        const runtime = resolveVillageCharacterRuntime(person);
        Object.assign(node.userData, {
          characterRuntimeAdapter: VILLAGE_CHARACTER_RUNTIME.id,
          characterRuntimeFamily: VILLAGE_CHARACTER_RUNTIME.family,
          characterRuntimeFormat: VILLAGE_CHARACTER_RUNTIME.format,
          characterRuntimeRig: VILLAGE_CHARACTER_RUNTIME.rigFamily,
          characterRuntimeState: runtime.state,
          characterRuntimeMotion: runtime.motion.resolvedState
        });
      }
    }
    return result;
  };
  view.__characterRuntimeIntegrated = true;
  view.canvas.dataset.characterRuntime = VILLAGE_CHARACTER_RUNTIME.id;
}
