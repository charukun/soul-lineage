import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export function createCompressedGLTFLoader({ renderer = null, manager = undefined, transcoderPath = '/basis/', residencyCache = null, assetHashForUrl = () => '' } = {}) {
  const loader = new GLTFLoader(manager);
  loader.setMeshoptDecoder(MeshoptDecoder);
  let ktx2 = null;
  if (renderer) {
    ktx2 = new KTX2Loader(manager).setTranscoderPath(transcoderPath);
    ktx2.detectSupport(renderer);
    loader.setKTX2Loader(ktx2);
  }
  return {
    loader,
    meshopt: true,
    ktx2: Boolean(ktx2),
    residency: Boolean(residencyCache),
    parseAsync(data, path = '') { return loader.parseAsync(data, path); },
    async loadAsync(url, onProgress = undefined) {
      if (!residencyCache) return loader.loadAsync(url, onProgress);
      const bytes = await residencyCache.arrayBuffer(url, { hash: assetHashForUrl(url) });
      let base = '';
      try {
        const absolute = new URL(url, globalThis.location?.href || 'https://local.invalid/');
        base = new URL('.', absolute).href;
      } catch {}
      return loader.parseAsync(bytes, base);
    },
    dispose() { ktx2?.dispose?.(); },
  };
}

export function compressedAssetCapabilities(renderer = null) {
  return Object.freeze({
    meshopt: true,
    ktx2: Boolean(renderer?.getContext),
    preferredTextureExtension: 'ktx2',
    preferredGeometryCompression: 'EXT_meshopt_compression',
  });
}
