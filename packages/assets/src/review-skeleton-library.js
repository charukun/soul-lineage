const repository = 'KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0';
const commit = '15b62b9bad122f72926c10fb14d622c73819fa54';
const characterRoot = 'addons/kaykit_character_pack_skeletons/Characters/gltf/';
const equipmentRoot = 'addons/kaykit_character_pack_skeletons/Assets/gltf/';
const reviewThumbnailUrl=id=>`./review/catalog-thumbnails.svg#${id}`;

export const REVIEW_SKELETON_SOURCE = Object.freeze({
  repository,
  commit,
  license: 'CC0-1.0',
  characterRoot,
  equipmentRoot,
});

const model = (id, label, file, byteLength, gitBlobSha) => Object.freeze({
  id,
  label,
  kind: 'review-asset-model',
  characterId: id,
  masterId: 'review-only:kaykit-skeletons',
  note: 'Visual Review専用。gameplay/save/Production stage/visualApprovalの正本には接続しません。',
  referencePath: `${repository}@${commit}/${characterRoot}${file}`,
  license: REVIEW_SKELETON_SOURCE.license,
  source: Object.freeze({repository, commit, path: `${characterRoot}${file}`, byteLength, gitBlobSha}),
  runtime: Object.freeze({url: `./asset-review/models/kaykit-skeletons/${file}`}),
  thumbnailUrl: reviewThumbnailUrl(id),
});

export const REVIEW_SKELETON_MODELS = Object.freeze([
  model('review-skeleton-warrior', 'Skeleton Warrior', 'Skeleton_Warrior.glb', 4863620, '769e85c9e4cee8d1bd0952ddb3e9d26293144581'),
  model('review-skeleton-rogue', 'Skeleton Rogue', 'Skeleton_Rogue.glb', 4827024, '182403932e4d4e00aa4182f2ac882ac27326dd19'),
  model('review-skeleton-mage', 'Skeleton Mage', 'Skeleton_Mage.glb', 4761048, '5f85aea26b4f33b88080d6eb57d25d1ae5d84d14'),
  model('review-skeleton-minion', 'Skeleton Minion', 'Skeleton_Minion.glb', 4814296, '3b7e7ee4f1c8dd6dd99ddad27824ef1dc52ff12d'),
]);

export const reviewSkeletonModel = id => REVIEW_SKELETON_MODELS.find(row => row.id === id) ?? null;

const equipment = (id, label, file, family, slots, targetFraction) => Object.freeze({
  id,
  label,
  file,
  family,
  slots: Object.freeze(slots),
  targetFraction,
  runtime: Object.freeze({url: `./asset-review/equipment/${file}.gltf`}),
  thumbnailUrl: reviewThumbnailUrl(id),
});

export const REVIEW_SKELETON_EQUIPMENT = Object.freeze([
  equipment('skeleton-blade', '骨剣', 'Skeleton_Blade', '1H_Sword', ['main','off','back'], .48),
  equipment('skeleton-axe', '骨斧', 'Skeleton_Axe', '1H_Axe', ['main','off','back'], .44),
  equipment('skeleton-staff', '骨杖', 'Skeleton_Staff', '2H_Staff', ['main','back'], .92),
  equipment('skeleton-crossbow', '骨クロスボウ', 'Skeleton_Crossbow', '2H_Crossbow', ['main','back'], .66),
  equipment('skeleton-shield-large-a', '骨大盾 A', 'Skeleton_Shield_Large_A', 'Rectangle_Shield', ['off','back'], .46),
  equipment('skeleton-shield-large-b', '骨大盾 B', 'Skeleton_Shield_Large_B', 'Rectangle_Shield', ['off','back'], .46),
  equipment('skeleton-shield-small-a', '骨小盾 A', 'Skeleton_Shield_Small_A', 'Round_Shield', ['off','back'], .36),
  equipment('skeleton-shield-small-b', '骨小盾 B', 'Skeleton_Shield_Small_B', 'Round_Shield', ['off','back'], .36),
  equipment('skeleton-quiver', '骨矢筒', 'Skeleton_Quiver', 'Quiver', ['back'], .46),
]);

export const reviewSkeletonEquipmentForSlot = slot => REVIEW_SKELETON_EQUIPMENT.filter(row => row.slots.includes(slot));

const remote = (id, path, output, size, gitBlob) => Object.freeze({id, repository, commit, path, output, size, gitBlob});
const equipmentFiles = [
  ['Skeleton_Blade',3047,'4ebd36b31663c00936b6270c15b6af751b5be091',20056,'98fa74bb4ecca0d474d8f992d10cbd7e55f18106'],
  ['Skeleton_Axe',3045,'79d77edd260b727980571b4b2836f942e0b31d3d',25348,'609e545071b90bfff0472719ae5229e0d206be68'],
  ['Skeleton_Staff',3057,'d0cff560383244e2ebbc4a593c0afb890082a514',69244,'5fc8906eb543a7e056e712993326a678456d4397'],
  ['Skeleton_Crossbow',3052,'11b414738856ae5611437373fcb4369ae6b90dca',28624,'6820e64878016c9564cee6962db4e35277cd7c2a'],
  ['Skeleton_Shield_Large_A',3071,'933c7dafe964bf6732dedbcbae703826d10dde42',33292,'83b1db6d9fbfea6ddeaffef189f01b4272247fd8'],
  ['Skeleton_Shield_Large_B',3068,'0131a29a8a59ec8af25ba2f1a1b7f891ef6d6904',18820,'84314927d716e317ba1b8a8dff41f203599d16d4'],
  ['Skeleton_Shield_Small_A',3069,'9fd9e757faacd046f8e6801c86b38b91e3a826df',21688,'2caef5d7294f1a1024c23c7482c8360bafeba665'],
  ['Skeleton_Shield_Small_B',3069,'7c1e7e7200857a908048dd7bde299e766d51f709',28636,'98fef166af9ec7424ef50110279b0ef4ebd53492'],
  ['Skeleton_Quiver',3051,'55069d42cbab011c0950a38a22a8e468960d0fed',18620,'b2783a64cf699fa6f51fd622e1ee5a875ae554fc'],
];

export const REVIEW_SKELETON_DOWNLOADS = Object.freeze([
  ...REVIEW_SKELETON_MODELS.map(row => remote(`model.${row.id}`, row.source.path, `models/kaykit-skeletons/${row.source.path.split('/').pop()}`, row.source.byteLength, row.source.gitBlobSha)),
  ...equipmentFiles.flatMap(([file,gltfSize,gltfBlob,binSize,binBlob]) => [
    remote(`equipment.${file}.gltf`, `${equipmentRoot}${file}.gltf`, `equipment/${file}.gltf`, gltfSize, gltfBlob),
    remote(`equipment.${file}.bin`, `${equipmentRoot}${file}.bin`, `equipment/${file}.bin`, binSize, binBlob),
  ]),
  remote('equipment.skeleton-texture', `${equipmentRoot}skeleton_texture.png`, 'equipment/skeleton_texture.png', 17037, '00bf24bd5fd17937e08fd90f819a7bc69de432b8'),
  remote('license.kaykit-skeletons', 'LICENSE.txt', 'licenses/KayKit-Skeletons-CC0.txt', 914, '5de5a1e35003680bd6b97b4c247eed71d51a9fb7'),
]);
