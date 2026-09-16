export const inspirationCatalogRevision = 'inspiration-catalog-1';

const defineArts = ({open, middle, finish, tag, desc}) => Object.freeze({
  open: Object.freeze([...open]),
  middle: Object.freeze([...middle]),
  finish: Object.freeze([...finish]),
  tag,
  desc,
});

// Canonical game-level eligibility catalog for techniques that may be discovered
// (閃き) and composed into 序・破・急. Runtimes own execution, damage, timing and
// animation implementations; they do not own this candidate set.
//
// Repeated IDs are intentional when they existed as selection weighting in the
// authored source. For example, spear/open keeps two `thrust` entries.
export const INSPIRATION_WEAPON_ARTS = Object.freeze({
  sword: defineArts({
    open: ['slash', 'diagonal', 'thrust', 'back'],
    middle: ['back', 'crosscut', 'uppercut', 'bash'],
    finish: ['heavy', 'crosscut', 'round', 'dash', 'bullrush', 'meteor'],
    tag: '太刀',
    desc: '片手剣と盾。斬り返し、刺し込み、十字斬り、盾での押し崩し。防御は心・技で設定。',
  }),
  great: defineArts({
    open: ['slash', 'back', 'diagonal', 'pommel'],
    middle: ['sweep', 'crosscut', 'back'],
    finish: ['heavy', 'round', 'leap', 'crosscut', 'bullrush', 'meteor'],
    tag: '断ち',
    desc: '大剣。広い薙ぎと重い打ち下ろしが中心。強い技ほど構えを深く取り、重さを乗せます。',
  }),
  spear: defineArts({
    open: ['thrust', 'thrust', 'sweep', 'pommel'],
    middle: ['thrust', 'sky', 'spearwheel'],
    finish: ['pierce', 'thrust', 'sky', 'sweep', 'bullrush', 'meteor', 'spearwheel'],
    tag: '穿ち',
    desc: '槍。長い間合いからの突き、穂先の払い、渾身の貫きを軸に閃きます。',
  }),
  axe: defineArts({
    open: ['diagonal', 'slash', 'sweep', 'pommel'],
    middle: ['back', 'bash', 'sweep'],
    finish: ['heavy', 'round', 'diagonal', 'leap', 'bullrush', 'meteor'],
    tag: '砕き',
    desc: '戦斧。袈裟斬りと押し崩しが得意。振り出しは慎重に、命中の瞬間は力強く。',
  }),
  fist: defineArts({
    open: ['jab', 'straight', 'bodyblow'],
    middle: ['straight', 'hook', 'bodyblow', 'risingfist'],
    finish: ['hook', 'risingfist', 'oneinch', 'barrage', 'rushfist'],
    tag: '拳',
    desc: '両拳で戦う近接武器。左の牽制、正拳、腹打ち、回し拳、突き上げ、連環双拳。剣や盾は持ちません。',
  }),
  katana: defineArts({
    open: ['katanaKesa', 'katanaThrust', 'katanaDraw'],
    middle: ['katanaReturn', 'crosscut', 'katanaThrust'],
    finish: ['katanaDraw', 'round', 'diagonal', 'bullrush', 'meteor'],
    tag: '一閃',
    desc: '刀。中段からの袈裟、逆袈裟、切っ先の突き、腰元からの居合い抜き。',
  }),
});

export const INSPIRATION_WEAPONS = Object.freeze(Object.keys(INSPIRATION_WEAPON_ARTS));

export const INSPIRATION_MOTION_IDS = Object.freeze([
  ...new Set(INSPIRATION_WEAPONS.flatMap(weapon => {
    const arts = INSPIRATION_WEAPON_ARTS[weapon];
    return [...arts.open, ...arts.middle, ...arts.finish];
  })),
]);

export function getInspirationWeaponArts(weapon) {
  const arts = INSPIRATION_WEAPON_ARTS[weapon];
  if (!arts) throw new Error(`Unknown inspiration weapon: ${weapon}`);
  return arts;
}

export function cloneInspirationWeaponArts() {
  return Object.fromEntries(INSPIRATION_WEAPONS.map(weapon => {
    const arts = INSPIRATION_WEAPON_ARTS[weapon];
    return [weapon, {
      open: [...arts.open],
      middle: [...arts.middle],
      finish: [...arts.finish],
      tag: arts.tag,
      desc: arts.desc,
    }];
  }));
}
