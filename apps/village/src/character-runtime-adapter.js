import { createCharacterRuntimeAdapter } from '@soul/characters';

export const VILLAGE_CHARACTER_RUNTIME = createCharacterRuntimeAdapter({
  id: 'village.procedural-resident.runtime.v1',
  family: 'village.procedural-resident.v1',
  rigFamily: 'procedural-humanoid-v1',
  format: 'procedural',
  asset: {
    id: 'procedural-resident-presentation',
    provenance: { source: 'apps/village', license: 'package-native' }
  },
  geometry: {
    upAxis: 'y',
    forwardAxis: '-z',
    origin: 'feet',
    scaleMode: 'appearance-height',
    sockets: { weapon: 'rightHand', offhand: 'leftHand', head: 'head' },
    collider: { shape: 'capsule', radiusRatio: 0.24, heightRatio: 0.9 }
  },
  motion: {
    idle: 'procedural:idle',
    walk: 'procedural:locomotion',
    run: 'procedural:locomotion',
    dash: 'procedural:locomotion',
    rest: 'procedural:idle',
    'combat-idle': 'procedural:defending',
    attack: 'procedural:defending',
    hit: 'procedural:defending',
    death: 'visibility:dead'
  }
});

export function resolveVillageCharacterRuntime(person = {}) {
  const speed = Number.isFinite(person.speed)
    ? Math.max(0, person.speed)
    : Math.hypot(Number(person.vx) || 0, Number(person.vz) || 0);
  return VILLAGE_CHARACTER_RUNTIME.resolve({
    dead: Boolean(person.dead),
    hit: Boolean(person.hit || person.hurt || person.downed),
    attacking: Boolean(person.attacking),
    resting: Boolean(person.resting || person.task === 'rest'),
    dashing: Boolean(person.dashing),
    moving: Boolean(person.moving) || speed > 0.05,
    speed,
    combat: person.task === 'defending' || Boolean(person.combat),
    runThreshold: 3
  });
}
