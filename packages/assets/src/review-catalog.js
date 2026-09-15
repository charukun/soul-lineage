/** Immutable acquisition inputs. Assets are candidates until visually approved. */
export const REVIEW_ASSET_REVISION = 'lanternfell-review.2';
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
const kaykitSkeletons = ['KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0', '15b62b9bad122f72926c10fb14d622c73819fa54'];
const remote = (id, source, path, output, size, gitBlob = null) => Object.freeze({
  id, repository: source[0], commit: source[1], path, output, size, gitBlob,
});
const weapon = 'addons/kaykit_character_pack_adventures/Assets/gltf/';
const skeletonWeapon = 'addons/kaykit_character_pack_skeletons/Assets/gltf/';
const skeletonCharacters = 'addons/kaykit_character_pack_skeletons/Characters/gltf/';

export const REVIEW_KAYKIT_EQUIPMENT_SOURCE = Object.freeze({
  repository: kaykit[0],
  commit: kaykit[1],
  license: 'CC0-1.0',
  sourceRoot: weapon,
  publicRoot: 'asset-review/equipment/',
});
export const REVIEW_KAYKIT_SKELETON_SOURCE = Object.freeze({
  repository: kaykitSkeletons[0],
  commit: kaykitSkeletons[1],
  license: 'CC0-1.0',
  characterRoot: skeletonCharacters,
  equipmentRoot: skeletonWeapon,
  publicModelRoot: 'asset-review/models/kaykit-skeletons/',
  publicEquipmentRoot: 'asset-review/equipment/',
});

const equipment = (source, id, file, family, slots, targetFraction) => Object.freeze({
  source,
  id,
  file,
  family,
  slots: Object.freeze(slots),
  targetFraction,
  publicPath: `asset-review/equipment/${file}.gltf`,
});
const adventurerEquipment = (id, file, family, slots, targetFraction) => equipment('adventurers', id, file, family, slots, targetFraction);
const skeletonEquipment = (id, file, family, slots, targetFraction) => equipment('skeletons', id, file, family, slots, targetFraction);

export const REVIEW_KAYKIT_EQUIPMENT = Object.freeze([
  adventurerEquipment('sword-1h', 'sword_1handed', '1H_Sword', ['main','off','back'], .47),
  adventurerEquipment('sword-2h', 'sword_2handed', '2H_Sword', ['main','back'], .78),
  adventurerEquipment('sword-2h-color', 'sword_2handed_color', '2H_Sword', ['main','back'], .78),
  adventurerEquipment('axe-1h', 'axe_1handed', '1H_Axe', ['main','off','back'], .42),
  adventurerEquipment('axe-2h', 'axe_2handed', '2H_Axe', ['main','back'], .68),
  adventurerEquipment('dagger', 'dagger', 'Knife', ['main','off','back'], .30),
  adventurerEquipment('staff', 'staff', '2H_Staff', ['main','back'], .92),
  adventurerEquipment('wand', 'wand', '1H_Wand', ['main','off','back'], .30),
  adventurerEquipment('crossbow-1h', 'crossbow_1handed', '1H_Crossbow', ['main','off','back'], .42),
  adventurerEquipment('crossbow-2h', 'crossbow_2handed', '2H_Crossbow', ['main','back'], .66),
  adventurerEquipment('shield-round', 'shield_round', 'Round_Shield', ['off','back'], .38),
  adventurerEquipment('shield-round-barbarian', 'shield_round_barbarian', 'Round_Shield', ['off','back'], .38),
  adventurerEquipment('shield-round-color', 'shield_round_color', 'Round_Shield', ['off','back'], .38),
  adventurerEquipment('shield-square', 'shield_square', 'Rectangle_Shield', ['off','back'], .42),
  adventurerEquipment('shield-square-color', 'shield_square_color', 'Rectangle_Shield', ['off','back'], .42),
  adventurerEquipment('shield-badge', 'shield_badge', 'Badge_Shield', ['off','back'], .38),
  adventurerEquipment('shield-badge-color', 'shield_badge_color', 'Badge_Shield', ['off','back'], .38),
  adventurerEquipment('shield-spikes', 'shield_spikes', 'Round_Shield', ['off','back'], .40),
  adventurerEquipment('shield-spikes-color', 'shield_spikes_color', 'Round_Shield', ['off','back'], .40),
  adventurerEquipment('quiver', 'quiver', 'Quiver', ['back'], .46),
  adventurerEquipment('spellbook-closed', 'spellbook_closed', 'Held_Book', ['off','back'], .30),
  adventurerEquipment('spellbook-open', 'spellbook_open', 'Held_Book', ['off'], .34),
  adventurerEquipment('smokebomb', 'smokebomb', 'Held_Small', ['main','off'], .16),
  adventurerEquipment('mug-empty', 'mug_empty', 'Held_Small', ['main','off'], .20),
  adventurerEquipment('mug-full', 'mug_full', 'Held_Small', ['main','off'], .20),
  skeletonEquipment('skeleton-blade', 'Skeleton_Blade', '1H_Sword', ['main','off','back'], .48),
  skeletonEquipment('skeleton-axe', 'Skeleton_Axe', '1H_Axe', ['main','off','back'], .44),
  skeletonEquipment('skeleton-staff', 'Skeleton_Staff', '2H_Staff', ['main','back'], .92),
  skeletonEquipment('skeleton-crossbow', 'Skeleton_Crossbow', '2H_Crossbow', ['main','back'], .66),
  skeletonEquipment('skeleton-shield-large-a', 'Skeleton_Shield_Large_A', 'Rectangle_Shield', ['off','back'], .46),
  skeletonEquipment('skeleton-shield-large-b', 'Skeleton_Shield_Large_B', 'Rectangle_Shield', ['off','back'], .46),
  skeletonEquipment('skeleton-shield-small-a', 'Skeleton_Shield_Small_A', 'Round_Shield', ['off','back'], .36),
  skeletonEquipment('skeleton-shield-small-b', 'Skeleton_Shield_Small_B', 'Round_Shield', ['off','back'], .36),
  skeletonEquipment('skeleton-quiver', 'Skeleton_Quiver', 'Quiver', ['back'], .46),
]);

export const REVIEW_KAYKIT_EXTRA_MODELS = Object.freeze([
  Object.freeze({id:'KAYKIT_SKELETON_WARRIOR',label:'Skeleton Warrior',name:'KayKit Skeleton Warrior',file:'Skeleton_Warrior.glb',size:4863620,gitBlob:'769e85c9e4cee8d1bd0952ddb3e9d26293144581',publicPath:'asset-review/models/kaykit-skeletons/Skeleton_Warrior.glb'}),
  Object.freeze({id:'KAYKIT_SKELETON_ROGUE',label:'Skeleton Rogue',name:'KayKit Skeleton Rogue',file:'Skeleton_Rogue.glb',size:4827024,gitBlob:'182403932e4d4e00aa4182f2ac882ac27326dd19',publicPath:'asset-review/models/kaykit-skeletons/Skeleton_Rogue.glb'}),
  Object.freeze({id:'KAYKIT_SKELETON_MAGE',label:'Skeleton Mage',name:'KayKit Skeleton Mage',file:'Skeleton_Mage.glb',size:4761048,gitBlob:'5f85aea26b4f33b88080d6eb57d25d1ae5d84d14',publicPath:'asset-review/models/kaykit-skeletons/Skeleton_Mage.glb'}),
  Object.freeze({id:'KAYKIT_SKELETON_MINION',label:'Skeleton Minion',name:'KayKit Skeleton Minion',file:'Skeleton_Minion.glb',size:4814296,gitBlob:'3b7e7ee4f1c8dd6dd99ddad27824ef1dc52ff12d',publicPath:'asset-review/models/kaykit-skeletons/Skeleton_Minion.glb'}),
]);

const adventurerEquipmentDownloads = REVIEW_KAYKIT_EQUIPMENT.filter(row => row.source === 'adventurers').flatMap(row => [
  remote(`equipment.kaykit.${row.file}`, kaykit, weapon + `${row.file}.gltf`, `equipment/${row.file}.gltf`, null),
  remote(`equipment.kaykit.${row.file}.buffer`, kaykit, weapon + `${row.file}.bin`, `equipment/${row.file}.bin`, null),
]);
const adventurerEquipmentTextures = ['knight_texture.png','barbarian_texture.png','mage_texture.png','rogue_texture.png'].map(file =>
  remote(`equipment.kaykit.texture.${file.replace('.png','')}`, kaykit, weapon + file, `equipment/${file}`, null),
);
const skeletonEquipmentDownloads = [
  ['Skeleton_Blade',3047,'4ebd36b31663c00936b6270c15b6af751b5be091',20056,'98fa74bb4ecca0d474d8f992d10cbd7e55f18106'],
  ['Skeleton_Axe',3045,'79d77edd260b727980571b4b2836f942e0b31d3d',25348,'609e545071b90bfff0472719ae5229e0d206be68'],
  ['Skeleton_Staff',3057,'d0cff560383244e2ebbc4a593c0afb890082a514',69244,'5fc8906eb543a7e056e712993326a678456d4397'],
  ['Skeleton_Crossbow',3052,'11b414738856ae5611437373fcb4369ae6b90dca',28624,'6820e64878016c9564cee6962db4e35277cd7c2a'],
  ['Skeleton_Shield_Large_A',3071,'933c7dafe964bf6732dedbcbae703826d10dde42',33292,'83b1db6d9fbfea6ddeaffef189f01b4272247fd8'],
  ['Skeleton_Shield_Large_B',3068,'0131a29a8a59ec8af25ba2f1a1b7f891ef6d6904',18820,'84314927d716e317ba1b8a8dff41f203599d16d4'],
  ['Skeleton_Shield_Small_A',3069,'9fd9e757faacd046f8e6801c86b38b91e3a826df',21688,'2caef5d7294f1a1024c23c7482c8360bafeba665'],
  ['Skeleton_Shield_Small_B',3069,'7c1e7e7200857a908048dd7bde299e766d51f709',28636,'98fef166af9ec7424ef50110279b0ef4ebd53492'],
  ['Skeleton_Quiver',3051,'55069d42cbab011c0950a38a22a8e468960d0fed',18620,'b2783a64cf699fa6f51fd622e1ee5a875ae554fc'],
].flatMap(([file,gltfSize,gltfBlob,binSize,binBlob]) => [
  remote(`equipment.kaykit-skeletons.${file}`, kaykitSkeletons, skeletonWeapon + `${file}.gltf`, `equipment/${file}.gltf`, gltfSize, gltfBlob),
  remote(`equipment.kaykit-skeletons.${file}.buffer`, kaykitSkeletons, skeletonWeapon + `${file}.bin`, `equipment/${file}.bin`, binSize, binBlob),
]);
const skeletonEquipmentTextures = [
  remote('equipment.kaykit-skeletons.texture', kaykitSkeletons, skeletonWeapon + 'skeleton_texture.png', 'equipment/skeleton_texture.png', 17037, '00bf24bd5fd17937e08fd90f819a7bc69de432b8'),
];
const skeletonModelDownloads = REVIEW_KAYKIT_EXTRA_MODELS.map(row =>
  remote(`model.kaykit-skeletons.${row.file}`, kaykitSkeletons, skeletonCharacters + row.file, `models/kaykit-skeletons/${row.file}`, row.size, row.gitBlob),
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
  remote('source.kaykit-skeletons.license', kaykitSkeletons, 'LICENSE.txt', 'licenses/KayKit-Skeletons-CC0.txt', 914, '5de5a1e35003680bd6b97b4c247eed71d51a9fb7'),
  ...adventurerEquipmentDownloads,
  ...adventurerEquipmentTextures,
  ...skeletonEquipmentDownloads,
  ...skeletonEquipmentTextures,
  ...skeletonModelDownloads,
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
