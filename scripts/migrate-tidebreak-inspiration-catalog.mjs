import {readFile, writeFile} from 'node:fs/promises';

const target = new URL('../packages/tidebreak-combat/index.js', import.meta.url);
let source = await readFile(target, 'utf8');

const importLine = "import { cloneInspirationWeaponArts } from '@soul/game-data';";
if (source.includes(importLine)) {
  console.log('Tidebreak inspiration catalog already migrated.');
  process.exit(0);
}

function replaceOnce(label, pattern, replacement) {
  const matches = source.match(pattern);
  if (!matches) throw new Error(`Migration anchor missing: ${label}`);
  source = source.replace(pattern, replacement);
}

replaceOnce(
  'module prelude',
  '/* Extracted Tidebreak authored runtime. See provenance.json. */',
  `${importLine}\n\n/* Extracted Tidebreak authored runtime. See provenance.json. */`,
);

replaceOnce(
  'legacy base WEAPON_ARTS object',
  /const WEAPON_ARTS=\{\n[\s\S]*?\n\};/,
  'const WEAPON_ARTS=cloneInspirationWeaponArts();',
);
replaceOnce('legacy fist arts', /WEAPON_ARTS\.fist=\{[^\n]*\};\n/, '');
replaceOnce(
  'legacy universal finishers',
  /for\(const w of \['sword','great','spear','axe'\]\)\{WEAPON_ARTS\[w\]\.finish\.push\('bullrush','meteor'\);\}\n/,
  '',
);
replaceOnce('legacy katana arts', /WEAPON_ARTS\.katana=\{[^\n]*\};\n/, '');
replaceOnce(
  'legacy spearwheel weighting',
  /WEAPON_ARTS\.spear\.middle\.push\('spearwheel'\);WEAPON_ARTS\.spear\.finish\.push\('spearwheel'\);\n/,
  '',
);
replaceOnce(
  'legacy damage filter',
  /for\(const arts of Object\.values\(WEAPON_ARTS\)\)for\(const group of \['open','middle','finish'\]\)arts\[group\]=arts\[group\]\.filter\(k=>STRIKES\[k\]\?\.damage>0\);\n/,
  '',
);
replaceOnce(
  'legacy sword description override',
  /WEAPON_ARTS\.sword\.desc='片手剣と盾。斬り返し、刺し込み、十字斬り、盾での押し崩し。防御は心・技で設定。';\n/,
  '',
);

replaceOnce(
  'facade catalog probe',
  " weapons:()=>Object.keys(WEAPONS),\n decodeNotebook:",
  " weapons:()=>Object.keys(WEAPONS),\n inspirationCatalog:()=>copy(WEAPON_ARTS),\n decodeNotebook:",
);
replaceOnce(
  'facade source version',
  "sourceVersion:'Tidebreak 10.0 / expanded-humanoid source'",
  "sourceVersion:'Tidebreak 10.0 / shared-inspiration catalog'",
);
replaceOnce(
  'facade generation probe',
  " _test:{hit(who,damage){",
  " _test:{\n  generateSkill(weapon='sword',slot='jo',automatic=true){const before=equippedWeapon;equippedWeapon=weapon;try{return copy(generateSkill(slot,automatic));}finally{equippedWeapon=before;}},\n  hit(who,damage){",
);

const forbidden = [
  'const WEAPON_ARTS={',
  'WEAPON_ARTS.fist=',
  'WEAPON_ARTS.katana=',
  "WEAPON_ARTS.spear.middle.push('spearwheel')",
  "finish.push('bullrush','meteor')",
];
for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`Legacy catalog ownership remains: ${token}`);
}
if (!source.includes('const WEAPON_ARTS=cloneInspirationWeaponArts();')) {
  throw new Error('Shared catalog clone is not the Tidebreak WEAPON_ARTS source.');
}
if (!source.includes('inspirationCatalog:()=>copy(WEAPON_ARTS)')) {
  throw new Error('Tidebreak facade does not expose the active catalog for verification.');
}
if (!source.includes("generateSkill(weapon='sword',slot='jo',automatic=true)")) {
  throw new Error('Tidebreak generation probe was not installed.');
}

await writeFile(target, source);
console.log('Migrated Tidebreak to @soul/game-data inspiration catalog.');
