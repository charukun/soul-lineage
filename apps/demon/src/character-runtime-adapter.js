import { KAYKIT_MODEL_BY_KEY, createCharacterRuntimeAdapter } from '@soul/characters';

const MODEL = KAYKIT_MODEL_BY_KEY.knight;

export const DEMON_CHARACTER_RUNTIME = createCharacterRuntimeAdapter({
  id: 'demon.kaykit-knight.runtime.v1',
  family: 'kaykit.adventurers.v1',
  rigFamily: 'Rig_Medium',
  format: 'glb',
  asset: {
    id: MODEL.id,
    provenance: { source: 'packages/characters/src/kaykit-foundation.js', license: 'CC0' }
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
    'combat-idle': 'combat-presentation:guard',
    attack: 'combat-presentation:attack',
    hit: 'combat-presentation:impact',
    death: 'visibility:dead'
  }
});

export function resolveDemonCharacterRuntime(actor = {}) {
  const speed = Number.isFinite(actor.speed)
    ? Math.max(0, actor.speed)
    : Math.hypot(Number(actor.vx) || 0, Number(actor.vz) || 0);
  return DEMON_CHARACTER_RUNTIME.resolve({
    dead: Boolean(actor.dead || actor.eaten),
    hit: Boolean(actor.hit || actor.hurt || (Number(actor.flash) || 0) > 0),
    attacking: Boolean(actor.attacking),
    resting: Boolean(actor.resting),
    dashing: Boolean(actor.dashing),
    moving: speed > 0.05 || actor.state === 'flee' || actor.state === 'pursue',
    speed,
    combat: actor.state === 'pursue' || Boolean(actor.combat || actor.pose),
    runThreshold: 3
  });
}
