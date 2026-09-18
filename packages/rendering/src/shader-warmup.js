const materialRows = node => (Array.isArray(node?.material) ? node.material : [node?.material]).filter(Boolean);

function collectMaterials(root, result) {
  root?.traverse?.(node => {
    for (const material of materialRows(node)) result.add(material);
  });
}

function expose(root) {
  const rows = [];
  root?.traverse?.(node => {
    rows.push([node, node.visible, node.frustumCulled]);
    node.visible = true;
    if ('frustumCulled' in node) node.frustumCulled = false;
  });
  return () => {
    for (const [node, visible, frustumCulled] of rows) {
      node.visible = visible;
      if ('frustumCulled' in node) node.frustumCulled = frustumCulled;
    }
  };
}

/**
 * Pre-compiles actual scene material variants without rendering them to the
 * visible framebuffer. Hidden registered roots are exposed only for the
 * duration of compileAsync/compile and restored in finally.
 */
export function createShaderWarmupManager(renderer, { maxVariants = 256 } = {}) {
  if (!renderer) throw new Error('Shader warmup requires a renderer');
  if (!Number.isInteger(maxVariants) || maxVariants < 1) throw new Error('Invalid shader variant budget');
  const passes = new Map();
  let runs = 0, compiledVariants = 0, lastMs = 0, lastReason = null, lastError = null;

  return {
    registerPass(label, scene, camera, { exposeRoots = [] } = {}) {
      if (!label || !scene || !camera) throw new Error('Shader warmup pass requires label, scene and camera');
      passes.set(String(label), { scene, camera, exposeRoots: [...exposeRoots] });
      return () => passes.delete(String(label));
    },
    async warmup(reason = 'manual') {
      const started = globalThis.performance?.now?.() ?? Date.now();
      let variants = 0;
      lastError = null;
      try {
        for (const pass of passes.values()) {
          const materials = new Set();
          collectMaterials(pass.scene, materials);
          for (const root of pass.exposeRoots) collectMaterials(root, materials);
          variants += materials.size;
          if (variants > maxVariants) throw new Error(`Shader variant budget exceeded: ${variants} > ${maxVariants}`);
          const restore = pass.exposeRoots.map(expose);
          try {
            if (typeof renderer.compileAsync === 'function') await renderer.compileAsync(pass.scene, pass.camera);
            else if (typeof renderer.compile === 'function') renderer.compile(pass.scene, pass.camera);
          } finally {
            for (const fn of restore.reverse()) fn();
          }
        }
      } catch (error) {
        lastError = String(error?.message || error);
        throw error;
      } finally {
        const ended = globalThis.performance?.now?.() ?? Date.now();
        lastMs = Math.max(0, ended - started);
        lastReason = String(reason);
        compiledVariants = variants;
        runs++;
      }
      return this.snapshot();
    },
    snapshot() {
      return Object.freeze({ runs, passes: passes.size, compiledVariants, maxVariants, lastMs, lastReason, lastError });
    },
    clear() { passes.clear(); },
  };
}
