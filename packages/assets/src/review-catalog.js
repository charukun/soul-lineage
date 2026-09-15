/** Immutable acquisition inputs. Assets are candidates until visually approved. */
export const REVIEW_ASSET_REVISION = 'lanternfell-review.1';
export const SHINO_REVIEW = Object.freeze({
  id: 'character.sendagaya-shino.v1',
  repositoryPath: 'apps/rinne/public/simulator/assets/SHINO_review.vrm',
  publicPath: 'simulator/assets/SHINO_review.vrm',
  size: 18541124,
  sha256: '83843ade7dbdfaacc9d601bda099fcb5757527e339b9c5deb223a2c2f5eb28ca',
  sourceCommit: '54bf3b66ab0531707834d6ba91b398070a318d29',
  originalTerms: 'https://vroid.pixiv.help/hc/en-us/articles/360013482714-Sendagaya-Shino',
  conversionTerms: 'https://hub.vroid.com/en/characters/4593660874193246717/models/7956589129305596116',
});
const norio = ['norio/vrm-game-starter', 'b14c236fd8150855348ad085b7820c298eac4b30'];
const kenney = ['Calinou/kenney-particle-pack', 'ab7086639ee73be31abd87feb21bf1402d4e8144'];
const kaykit = ['KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0', '672074b73ba276876a19e8816ecdc5241817ab47'];
const remote = (id, source, path, output, size, gitBlob = null) => Object.freeze({
  id, repository: source[0], commit: source[1], path, output, size, gitBlob,
});
const weapon = 'addons/kaykit_character_pack_adventures/Assets/gltf/';

export const REVIEW_KAYKIT_EQUIPMENT_SOURCE = Object.freeze({
  repository: kaykit[0],
  commit: kaykit[1],
  license: 'CC0-1.0',
  sourceRoot: weapon,
  publicRoot: 'asset-review/equipment/',
});

const equipment = (id, file, family, slots, targetFraction) => Object.freeze({
  id,
  file,
  family,
  slots: Object.freeze(slots),
  targetFraction,
  publicPath: `${REVIEW_KAYKIT_EQUIPMENT_SOURCE.publicRoot}${file}.gltf`,
});

/**
 * Real KayKit Adventurers equipment models included in the built Review Lab.
 * These are presentation assets only; they do not create gameplay inventory.
 */
export const REVIEW_KAYKIT_EQUIPMENT = Object.freeze([
  equipment('sword-1h', 'sword_1handed', '1H_Sword', ['main','off','back'], .47),
  equipment('sword-2h', 'sword_2handed', '2H_Sword', ['main','back'], .78),
  equipment('sword-2h-color', 'sword_2handed_color', '2H_Sword', ['main','back'], .78),
  equipment('axe-1h', 'axe_1handed', '1H_Axe', ['main','off','back'], .42),
  equipment('axe-2h', 'axe_2handed', '2H_Axe', ['main','back'], .68),
  equipment('dagger', 'dagger', 'Knife', ['main','off','back'], .30),
  equipment('staff', 'staff', '2H_Staff', ['main','back'], .92),
  equipment('wand', 'wand', '1H_Wand', ['main','off','back'], .30),
  equipment('crossbow-1h', 'crossbow_1handed', '1H_Crossbow', ['main','off','back'], .42),
  equipment('crossbow-2h', 'crossbow_2handed', '2H_Crossbow', ['main','back'], .66),
  equipment('shield-round', 'shield_round', 'Round_Shield', ['off','back'], .38),
  equipment('shield-round-barbarian', 'shield_round_barbarian', 'Round_Shield', ['off','back'], .38),
  equipment('shield-round-color', 'shield_round_color', 'Round_Shield', ['off','back'], .38),
  equipment('shield-square', 'shield_square', 'Rectangle_Shield', ['off','back'], .42),
  equipment('shield-square-color', 'shield_square_color', 'Rectangle_Shield', ['off','back'], .42),
  equipment('shield-badge', 'shield_badge', 'Badge_Shield', ['off','back'], .38),
  equipment('shield-badge-color', 'shield_badge_color', 'Badge_Shield', ['off','back'], .38),
  equipment('shield-spikes', 'shield_spikes', 'Round_Shield', ['off','back'], .40),
  equipment('shield-spikes-color', 'shield_spikes_color', 'Round_Shield', ['off','back'], .40),
  equipment('quiver', 'quiver', 'Quiver', ['back'], .46),
  equipment('spellbook-closed', 'spellbook_closed', 'Held_Book', ['off','back'], .30),
  equipment('spellbook-open', 'spellbook_open', 'Held_Book', ['off'], .34),
  equipment('smokebomb', 'smokebomb', 'Held_Small', ['main','off'], .16),
  equipment('mug-empty', 'mug_empty', 'Held_Small', ['main','off'], .20),
  equipment('mug-full', 'mug_full', 'Held_Small', ['main','off'], .20),
]);

const reviewEquipmentDownloads = REVIEW_KAYKIT_EQUIPMENT.flatMap(row => [
  remote(`equipment.kaykit.${row.file}`, kaykit, weapon + `${row.file}.gltf`, `equipment/${row.file}.gltf`, null),
  remote(`equipment.kaykit.${row.file}.buffer`, kaykit, weapon + `${row.file}.bin`, `equipment/${row.file}.bin`, null),
]);
const reviewEquipmentTextures = ['knight_texture.png','barbarian_texture.png','mage_texture.png','rogue_texture.png'].map(file =>
  remote(`equipment.kaykit.texture.${file.replace('.png','')}`, kaykit, weapon + file, `equipment/${file}`, null),
);

export const REVIEW_DOWNLOADS = Object.freeze([
  remote('animation.quaternius.library', norio, 'src/assets/AnimationLibrary.glb', 'AnimationLibrary.glb', 6671104, '8ce67624ba3bb4d2ca20a4ac188fe38ceaaab97e'),
  remote('source.norio.license', norio, 'LICENSE', 'licenses/norio-MIT.txt', 1142, 'bc92046795821947d385f35a7446a5a2b4570825'),
  remote('source.norio.readme', norio, 'README.md', 'licenses/norio-README.md', 6178, '4ae9f4a0cbb21a441bb09683ec1cd6e6d2f86751'),
  remote('vfx.kenney.impact', kenney, 'addons/kenney_particle_pack/flare_01.png', 'particles/flare_01.png', 39143, 'bd25bd874e47467e95d6623aa0364be1c619617a'),
  remote('vfx.kenney.dust', kenney, 'addons/kenney_particle_pack/dirt_01.png', 'particles/dirt_01.png', 46129, '3bf82433236c8a0e5452563dccafd0ca4ec82a31'),
  remote('vfx.kenney.light', kenney, 'addons/kenney_particle_pack/light_01.png', 'particles/light_01.png', 86592, '0192157986a9c7d2406a53d1b56e3b055fde84de'),
  remote('source.kenney.license', kenney, 'LICENSE.txt', 'licenses/Kenney-CC0.txt', 629, 'e198510d3c6ac7e3dc4370f1f0861d8c617362e8'),
  remote('weapon.kaykit.greatsword', kaykit, weapon + 'sword_2handed.gltf', 'weapon/sword_2handed.gltf', null, '593016769c491c37ce4705bc76f80e2a042ccaee'),
  remote('weapon.kaykit.greatsword.buffer', kaykit, weapon + 'sword_2handed.bin', 'weapon/sword_2handed.bin', 19912),
  remote('weapon.kaykit.knight.texture', kaykit, weapon + 'knight_texture.png', 'weapon/knight_texture.png', 14172, 'a56eae7514f908862e304620b89dc2d0cb9f362f'),
  remote('source.kaykit.license', kaykit, 'LICENSE.txt', 'licenses/KayKit-CC0.txt', 891, '877e44735b5869c10e17a59e3b757905aa390626'),
  ...reviewEquipmentDownloads,
  ...reviewEquipmentTextures,
]);
export const REVIEW_MOTION_FAMILIES = Object.freeze([
  { id: 'idle', label: '待機', pattern: '^Idle' },
  { id: 'walk', label: '歩行', pattern: '^Walk' },
  { id: 'run', label: '走行', pattern: '^(Jog|Run|Sprint)' },
  { id: 'sword', label: '剣攻撃', pattern: 'Sword.*(Attack|Slash)|(?:Attack|Slash).*Sword|^Melee' },
  { id: 'hit', label: '被弾', pattern: 'Hit|Impact|Hurt|Damage' },
  { id: 'death', label: '死亡', pattern: 'Death|Die|Dead' },
]);
export function classifyMotion(name) {
  return REVIEW_MOTION_FAMILIES.find(row => new RegExp(row.pattern, 'i').test(name))?.id || 'other';
}
export function sourceUrl(row) {
  if (!/^[0-9a-f]{40}$/.test(row.commit) || row.path.split('/').includes('..')) throw new Error('Unpinned asset source');
  return `https://raw.githubusercontent.com/${row.repository}/${row.commit}/${row.path}`;
}
