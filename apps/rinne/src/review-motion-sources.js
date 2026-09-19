import { KAYKIT_MODELS } from '@soul/characters';

// Only immutable, explicitly licensed upstream files belong here. Counts are
// generated from their animation data, never from the number of target models.
const knight = KAYKIT_MODELS[0];
const kaykitRepository = 'GeorgeQLe/assets-kaykit-3d-characters';
const kaykitRevision = 'af08a62d3669370ec4636ae6314b38cdcd5dd759';
const universalRepository = 'richardanaya/metaverse-avatar';
const universalRevision = '84fd636910bf713099010efbab7f3c84550f4bcb';
const pack = (id, label, repository, revision, path, gitBlobSha, byteLength, family, author, originalSource) => Object.freeze({
  id, label, repository, revision, path, gitBlobSha, byteLength, family, author,
  originalSource, license: 'CC0-1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  url: `./simulator/assets/motion-library/${id}.glb`
});
const kaykit = (name, gitBlobSha, byteLength) => pack(
  `kaykit-${name.toLowerCase()}`, `KayKit ${name}`, kaykitRepository, kaykitRevision,
  `assets/kaykit/character-animations-1.1/Animations/gltf/Rig_Medium/Rig_Medium_${name}.glb`,
  gitBlobSha, byteLength, 'kaykit', 'Kay Lousberg', 'https://kaylousberg.com/game-assets/character-animations'
);
export const MOTION_LIBRARY_SOURCES = Object.freeze([
  Object.freeze({ ...knight.source, id: 'kaykit-embedded', label: 'KayKit Adventurers embedded',
    family: 'kaykit', author: 'Kay Lousberg', license: knight.license,
    originalSource: 'https://kaylousberg.com/game-assets/characters-adventurers',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', url: knight.runtime.url, baseline: true }),
  kaykit('CombatMelee', '0ab63f221ca5d5c7c485a245199fb6107f1f3764', 999416),
  kaykit('CombatRanged', 'df56bad0071108e4d735771483233aa4fc85456c', 1014852),
  kaykit('General', '5d16cb6815fc8371705147188813f851c10ba26a', 828240),
  kaykit('MovementAdvanced', 'f3ea309627f3ad76b92b85877ebc46f945cd4f1d', 719628),
  kaykit('MovementBasic', '98e965e886ec539e80f8984a77a29b0c1c02e5e5', 689624),
  kaykit('Simulation', 'c64056cda5d2fca14ecb3b61d02d9dde56d1b401', 855904),
  kaykit('Special', '4c2277dee56909c52800430f0a0daa419fe58654', 924308),
  kaykit('Tools', 'bc9db031f6608ce4b5e2b1c07f3cfae0c9b152a3', 1461204),
  pack('quaternius-ual1', 'Quaternius UAL 1 Standard', universalRepository, universalRevision,
    'anims/UAL1_Standard.glb', '410b30c617cc3097f7d82e36d4c28ef130f66388', 8114364,
    'quaternius', 'Quaternius', 'https://quaternius.com/packs/universalanimationlibrary.html'),
  pack('quaternius-ual2', 'Quaternius UAL 2 Standard', universalRepository, universalRevision,
    'anims/UAL2_Standard.glb', 'dc684c2a664927964307e8eb7b27b0000ebf6a18', 8061600,
    'quaternius', 'Quaternius; Gonzalo Furnier', 'https://quaternius.com/packs/universalanimationlibrary2.html')
]);
export const MOTION_LIBRARY_MANIFEST_URL = './simulator/assets/motion-library/catalog.json';
