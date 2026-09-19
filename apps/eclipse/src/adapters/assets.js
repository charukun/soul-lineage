import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
/** Only original third-party GLB meshes. No primitive or generated model fallback. */
export class Assets {
  constructor() { this.models = new Map(); this.manifest = []; }
  async load(onProgress) {
    const response = await fetch('./models/manifest.json');
    if (!response.ok) throw new Error('アセットの一覧を読み込めませんでした。');
    this.manifest = await response.json();
    const loader = new GLTFLoader(); let completed = 0;
    const queue = [...this.manifest];
    const worker = async () => {
      while (queue.length) {
        const item = queue.shift();
        try {
          const model = await loader.loadAsync(`./${item.file}`);
          this.models.set(item.id, model);
          model.scene.traverse(o => {
            if (!o.isMesh) return;
            o.castShadow = true; o.receiveShadow = true;
            o.frustumCulled = !o.isSkinnedMesh;
            const materials = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of materials) { m.roughness = Math.min(m.roughness ?? 1, .88); }
          });
          onProgress(++completed, this.manifest.length, item.id);
        } catch (error) { throw new Error(`${item.id} の読込に失敗しました。通信を確認して再読み込みしてください。`, {cause:error}); }
      }
    };
    await Promise.all(Array.from({length:4}, worker));
  }
  model(id) { const value = this.models.get(id); if (!value) throw new Error(`Missing original model: ${id}`); return value; }
  character(id) { return clone(this.model(id).scene); }
  prop(id) { return this.model(id).scene.clone(true); }
  weapon(twoHanded = false) {
    const source = this.model('Knight').scene.getObjectByName(twoHanded ? '2H_Sword' : '1H_Sword');
    if (!source) throw new Error('Original weapon asset is missing.');
    const result = source.clone(true); result.visible = true; return result;
  }
}
export function findNode(root, name) {
  let found;
  root.traverse(n => { if (n.name.replaceAll('.', '').replaceAll('_', '').toLowerCase() === name.replaceAll('.', '').replaceAll('_', '').toLowerCase()) found = n; });
  return found;
}
