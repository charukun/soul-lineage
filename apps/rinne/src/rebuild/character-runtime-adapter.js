import { createCharacterRuntimeAdapter } from '@soul/characters';

export const RINNE_CHARACTER_RUNTIME = createCharacterRuntimeAdapter({
  id: 'rinne.kaykit.runtime.v1',
  family: 'kaykit.adventurers.v1',
  rigFamily: 'Rig_Medium',
  format: 'glb',
  asset: {
    id: 'kaykit.adventurers.v1',
    provenance: { source: 'packages/characters/src/kaykit-foundation.js', license: 'CC0' }
  },
  geometry: {
    upAxis: 'y',
    forwardAxis: '-z',
    origin: 'feet',
    scaleMode: 'native',
    sockets: { weapon: 'rightHand', offhand: 'leftHand', head: 'head' },
    collider: { shape: 'capsule', radiusRatio: 0.24, heightRatio: 0.9 }
  },
  motion: {
    idle: 'pose-humanoid:idle',
    walk: 'pose-humanoid:locomotion',
    run: 'pose-humanoid:locomotion',
    dash: 'pose-humanoid:locomotion',
    rest: 'pose-humanoid:idle',
    'combat-idle': 'pose-humanoid:combat',
    attack: 'pose-humanoid:combat',
    hit: 'pose-humanoid:combat',
    death: 'visibility:dead'
  }
});

export function resolveRinneCharacterRuntime(input = {}) {
  return RINNE_CHARACTER_RUNTIME.resolve(input);
}
