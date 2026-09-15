import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export function createCompressedGLTFLoader({ renderer = null, manager = undefined, transcoderPath = '/basis/' } = {}) {
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
    parseAsync(data, path = '') { return loader.parseAsync(data, path); },
    loadAsync(url, onProgress = undefined) { return loader.loadAsync(url, onProgress); },
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
