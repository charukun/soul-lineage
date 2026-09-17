import { KAYKIT_FAMILY_ID, KAYKIT_MODEL_BY_KEY, KAYKIT_RIG_ID, createCharacterRuntimeAdapter } from '@soul/characters';

const MODEL = KAYKIT_MODEL_BY_KEY.rogue;

export const VILLAGE_CHARACTER_RUNTIME = createCharacterRuntimeAdapter({
  id: 'village.kaykit-human.runtime.v2',
  family: KAYKIT_FAMILY_ID,
  rigFamily: KAYKIT_RIG_ID,
  format: 'glb',
  asset: {
    id: MODEL.id,
    provenance: { source: 'packages/characters/src/kaykit-foundation.js', license: MODEL.license }
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
    idle: 'shared-motion:idle',
    walk: 'shared-motion:locomotion',
    run: 'shared-motion:locomotion',
    dash: 'shared-motion:locomotion',
    rest: 'shared-motion:idle',
    'combat-idle': 'shared-motion:guard',
    attack: 'shared-motion:attack',
    hit: 'shared-motion:impact',
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
