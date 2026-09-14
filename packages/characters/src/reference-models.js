import { canonicalAppearanceParts } from './appearance-parts.js';
import { MASTER_ID } from './master-character.js';
import { validateVisualIdentity } from './visual-identity.js';

export const CHARACTER_REFERENCE_MODEL_VERSION = 2;

const FACE = Object.freeze({
  soft: Object.freeze({ jaw: .94, cheek: 1.06, nose: .92, eyeWidth: 1.08, eyeHeight: 1.08, eyeSpacing: 1.02, browWeight: .84, browSlant: 0, chin: .94 }),
  child: Object.freeze({ jaw: .91, cheek: 1.11, nose: .88, eyeWidth: 1.12, eyeHeight: 1.14, eyeSpacing: 1.04, browWeight: .78, browSlant: 0, chin: .90 }),
  adult: Object.freeze({ jaw: 1.02, cheek: 1.00, nose: 1.02, eyeWidth: .98, eyeHeight: .96, eyeSpacing: 1, browWeight: 1.02, browSlant: .02, chin: 1.02 }),
  sturdy: Object.freeze({ jaw: 1.10, cheek: 1.02, nose: 1.04, eyeWidth: .96, eyeHeight: .94, eyeSpacing: 1, browWeight: 1.12, browSlant: .04, chin: 1.07 }),
  sharp: Object.freeze({ jaw: .96, cheek: .96, nose: 1.05, eyeWidth: 1.01, eyeHeight: .93, eyeSpacing: .98, browWeight: 1.08, browSlant: .06, chin: 1.08 }),
  elder: Object.freeze({ jaw: 1.02, cheek: .94, nose: 1.10, eyeWidth: .95, eyeHeight: .88, eyeSpacing: 1, browWeight: 1.02, browSlant: 0, chin: 1.04 })
});

const PALETTE = Object.freeze({
  shino: { skin: [.96,.80,.72], hair: [.62,.39,.27], eyes: [.36,.23,.16], primary: [.20,.32,.16], secondary: [.83,.78,.68], accent: [.64,.49,.25], dark: [.16,.12,.10], metal: [.55,.55,.50], leather: [.29,.18,.12], wood: [.32,.20,.11] },
  villageBoy: { skin: [.88,.69,.58], hair: [.30,.20,.14], eyes: [.30,.24,.18], primary: [.34,.39,.28], secondary: [.67,.58,.45], accent: [.48,.35,.22], dark: [.15,.13,.11], metal: [.48,.50,.48], leather: [.28,.19,.13], wood: [.34,.23,.13] },
  villageGirl: { skin: [.94,.76,.67], hair: [.48,.30,.20], eyes: [.30,.38,.30], primary: [.38,.46,.34], secondary: [.78,.69,.57], accent: [.62,.42,.34], dark: [.16,.13,.11], metal: [.52,.53,.50], leather: [.31,.21,.14], wood: [.36,.24,.14] },
  elderMan: { skin: [.76,.61,.53], hair: [.62,.62,.58], eyes: [.28,.25,.22], primary: [.34,.31,.27], secondary: [.54,.50,.42], accent: [.42,.35,.26], dark: [.14,.13,.12], metal: [.46,.47,.45], leather: [.27,.20,.15], wood: [.31,.24,.17] },
  elderWoman: { skin: [.80,.64,.56], hair: [.70,.68,.63], eyes: [.30,.27,.24], primary: [.42,.36,.36], secondary: [.62,.55,.48], accent: [.52,.43,.35], dark: [.16,.14,.13], metal: [.47,.48,.45], leather: [.29,.22,.17], wood: [.34,.25,.17] },
  guard: { skin: [.84,.66,.55], hair: [.30,.20,.14], eyes: [.24,.27,.25], primary: [.28,.35,.30], secondary: [.56,.53,.45], accent: [.58,.48,.31], dark: [.13,.12,.11], metal: [.58,.60,.57], leather: [.28,.19,.13], wood: [.30,.21,.13] },
  knight: { skin: [.88,.70,.60], hair: [.46,.32,.23], eyes: [.30,.34,.36], primary: [.18,.27,.42], secondary: [.82,.80,.73], accent: [.72,.61,.38], dark: [.12,.12,.13], metal: [.76,.78,.76], leather: [.27,.20,.15], wood: [.33,.24,.16] },
  blacksmith: { skin: [.78,.58,.46], hair: [.24,.17,.13], eyes: [.25,.22,.19], primary: [.35,.27,.23], secondary: [.48,.39,.31], accent: [.62,.43,.25], dark: [.12,.11,.10], metal: [.46,.47,.45], leather: [.25,.16,.11], wood: [.31,.20,.12] },
  laborer: { skin: [.86,.66,.53], hair: [.32,.21,.14], eyes: [.30,.25,.18], primary: [.39,.34,.28], secondary: [.70,.64,.54], accent: [.48,.38,.26], dark: [.14,.12,.10], metal: [.48,.49,.47], leather: [.30,.20,.13], wood: [.36,.24,.14] },
  hunter: { skin: [.82,.64,.53], hair: [.31,.21,.15], eyes: [.26,.34,.25], primary: [.27,.35,.25], secondary: [.53,.48,.38], accent: [.50,.40,.25], dark: [.13,.12,.10], metal: [.44,.46,.44], leather: [.27,.18,.12], wood: [.39,.28,.16] },
  arcanist: { skin: [.86,.70,.62], hair: [.36,.30,.35], eyes: [.38,.31,.52], primary: [.30,.24,.42], secondary: [.64,.58,.70], accent: [.65,.54,.32], dark: [.13,.11,.16], metal: [.55,.52,.61], leather: [.25,.18,.23], wood: [.31,.23,.29] }
});

function parts(face, hair, body, outfit, accessory = 'none') {
  return canonicalAppearanceParts({ version: 1, face, hair, body, outfit, accessory });
}

function proportions(shoulders = 1, arms = 1, legs = 1, head = 1) {
  return Object.freeze({ shoulders, arms, legs, head });
}

function style(design, scale, palette, options = {}) {
  return Object.freeze({
    version: 1,
    design,
    scale,
    palette: Object.freeze(Object.fromEntries(Object.entries(PALETTE[palette]).map(([key, value]) => [key, Object.freeze([...value])]))),
    ...options
  });
}

function model(spec) {
  const profile = parts(...spec.parts);
  const value = {
    version: 1,
    seed: spec.seed,
    role: spec.role,
    ageBand: spec.ageBand,
    parts: profile,
    front: spec.front,
    back: spec.back,
    face: Object.freeze({ ...FACE[spec.face] }),
    proportions: spec.proportions,
    gear: spec.gear,
    cloth: Object.freeze([...spec.referenceStyle.palette.primary]),
    trim: Object.freeze([...spec.referenceStyle.palette.accent]),
    hairValue: 1,
    id: spec.id,
    label: spec.label,
    kind: 'runtime-reference-model',
    characterId: spec.characterId,
    masterId: MASTER_ID,
    assetId: `runtime.${spec.id}`,
    referencePath: spec.referencePath,
    profile,
    referenceStyle: spec.referenceStyle,
    note: 'リファレンス専用ランタイム3D。監査済み共通リグに専用形状を装着し、Visual Review Labでモーション・全周確認できる。'
  };
  validateVisualIdentity(value);
  Object.freeze(value.face); Object.freeze(value.proportions); Object.freeze(value.parts); Object.freeze(value.profile);
  return Object.freeze(value);
}

const npcPath = name => `docs/characters/references/npc-role-set/${name}.avif`;

export const CHARACTER_REFERENCE_MODELS = Object.freeze({
  'shino.reference.v2': model({
    id: 'shino.reference.v2', label: 'Shino', characterId: 'Sendagaya_Shino', seed: 0x5348494e, role: 'traveller', ageBand: 'child',
    parts: ['round','bob','compact','mantle','none'], front: 'fringe', back: 'layered', face: 'soft', proportions: proportions(.94,.97,.94,1.08), gear: 'satchel',
    referencePath: 'docs/characters/references/shino/shino-character-reference-sheet-v2.png',
    referenceStyle: style('shino', .70, 'shino', { armStyle: 'blouse', legStyle: 'bare', footwear: 'boots', prop: 'satchel' })
  }),
  'child-boy.reference.v1': model({
    id: 'child-boy.reference.v1', label: 'Child Boy', characterId: 'Reference_Child_Boy', seed: 0x43484231, role: 'child', ageBand: 'child',
    parts: ['round','crop','compact','tunic','none'], front: 'open', back: 'close', face: 'child', proportions: proportions(.92,.94,.91,1.12), gear: 'none',
    referencePath: npcPath('child-boy'),
    referenceStyle: style('child-boy', .61, 'villageBoy', { armStyle: 'shirt', legStyle: 'pants', footwear: 'boots', prop: 'none' })
  }),
  'child-girl.reference.v1': model({
    id: 'child-girl.reference.v1', label: 'Child Girl', characterId: 'Reference_Child_Girl', seed: 0x43484731, role: 'child', ageBand: 'child',
    parts: ['round','bob','compact','tunic','headband'], front: 'fringe', back: 'layered', face: 'child', proportions: proportions(.90,.93,.91,1.12), gear: 'none',
    referencePath: npcPath('child-girl'),
    referenceStyle: style('child-girl', .60, 'villageGirl', { armStyle: 'shirt', legStyle: 'leggings', footwear: 'boots', prop: 'ribbon' })
  }),
  'elderly-man.reference.v1': model({
    id: 'elderly-man.reference.v1', label: 'Elderly Man', characterId: 'Reference_Elderly_Man', seed: 0x454c4d31, role: 'elder', ageBand: 'elder',
    parts: ['long','crop','slender','mantle','none'], front: 'swept', back: 'close', face: 'elder', proportions: proportions(.96,.96,.94,.98), gear: 'shawl',
    referencePath: npcPath('elderly-man'),
    referenceStyle: style('elderly-man', .82, 'elderMan', { armStyle: 'shirt', legStyle: 'pants', footwear: 'boots', prop: 'cane' })
  }),
  'elderly-woman.reference.v1': model({
    id: 'elderly-woman.reference.v1', label: 'Elderly Woman', characterId: 'Reference_Elderly_Woman', seed: 0x454c5731, role: 'elder', ageBand: 'elder',
    parts: ['round','tail','slender','mantle','none'], front: 'parted', back: 'tied', face: 'elder', proportions: proportions(.92,.94,.93,1.00), gear: 'shawl',
    referencePath: npcPath('elderly-woman'),
    referenceStyle: style('elderly-woman', .79, 'elderWoman', { armStyle: 'shirt', legStyle: 'skirt', footwear: 'boots', prop: 'basket', hairExtra: 'bun' })
  }),
  'guard.reference.v1': model({
    id: 'guard.reference.v1', label: 'Guard', characterId: 'Reference_Guard', seed: 0x47554152, role: 'guard', ageBand: 'adult',
    parts: ['classic','crop','sturdy','tunic','scarf'], front: 'open', back: 'close', face: 'sturdy', proportions: proportions(1.10,1.02,1.00,.96), gear: 'armor',
    referencePath: npcPath('guard'),
    referenceStyle: style('guard', .90, 'guard', { armStyle: 'armor', legStyle: 'pants', footwear: 'greaves', prop: 'spear' })
  }),
  'knight.reference.v1': model({
    id: 'knight.reference.v1', label: 'Knight', characterId: 'Reference_Knight', seed: 0x4b4e4731, role: 'knight', ageBand: 'adult',
    parts: ['sharp','crop','balanced','mantle','none'], front: 'swept', back: 'layered', face: 'sharp', proportions: proportions(1.07,1.01,1.03,.96), gear: 'armor',
    referencePath: npcPath('knight'),
    referenceStyle: style('knight', .92, 'knight', { armStyle: 'armor', legStyle: 'armor', footwear: 'greaves', prop: 'sword' })
  }),
  'blacksmith.reference.v1': model({
    id: 'blacksmith.reference.v1', label: 'Blacksmith', characterId: 'Reference_Blacksmith', seed: 0x424c4b31, role: 'smith', ageBand: 'adult',
    parts: ['classic','crop','sturdy','apron','headband'], front: 'open', back: 'close', face: 'sturdy', proportions: proportions(1.12,1.06,.98,.94), gear: 'tools',
    referencePath: npcPath('blacksmith'),
    referenceStyle: style('blacksmith', .91, 'blacksmith', { armStyle: 'rolled', legStyle: 'pants', footwear: 'boots', prop: 'hammer' })
  }),
  'laborer.reference.v1': model({
    id: 'laborer.reference.v1', label: 'Laborer', characterId: 'Reference_Laborer', seed: 0x4c414231, role: 'laborer', ageBand: 'adult',
    parts: ['classic','crop','sturdy','apron','none'], front: 'open', back: 'layered', face: 'adult', proportions: proportions(1.06,1.03,1.01,.96), gear: 'pack',
    referencePath: npcPath('laborer'),
    referenceStyle: style('laborer', .89, 'laborer', { armStyle: 'rolled', legStyle: 'pants', footwear: 'boots', prop: 'toolbelt' })
  }),
  'hunter.reference.v1': model({
    id: 'hunter.reference.v1', label: 'Hunter', characterId: 'Reference_Hunter', seed: 0x48554e31, role: 'hunter', ageBand: 'adult',
    parts: ['sharp','crop','slender','mantle','scarf'], front: 'swept', back: 'layered', face: 'sharp', proportions: proportions(.99,1.03,1.05,.96), gear: 'quiver',
    referencePath: npcPath('hunter'),
    referenceStyle: style('hunter', .88, 'hunter', { armStyle: 'shirt', legStyle: 'pants', footwear: 'boots', prop: 'bow' })
  }),
  'arcanist.reference.v1': model({
    id: 'arcanist.reference.v1', label: 'Arcanist', characterId: 'Reference_Arcanist', seed: 0x41524331, role: 'arcanist', ageBand: 'adult',
    parts: ['long','tail','slender','mantle','glasses'], front: 'parted', back: 'tied', face: 'soft', proportions: proportions(.96,1.00,1.03,.99), gear: 'cowl',
    referencePath: npcPath('arcanist'),
    referenceStyle: style('arcanist', .86, 'arcanist', { armStyle: 'robe', legStyle: 'robe', footwear: 'boots', prop: 'staff-book' })
  })
});

export function characterReferenceModel(id) {
  const model = CHARACTER_REFERENCE_MODELS[id];
  if (!model) throw new Error(`Unknown character reference model: ${id}`);
  return model;
}
