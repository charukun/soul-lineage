/** Artist-authored downloads only. Paths verified against the pinned source tree. */
export const repository = 'agentkaerf/FreeModels';
export const revision = 'db3df04d1e4714298a09510b26fb6de6645138a2';
const packs = {
  hero: ['Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits/', 'https://quaternius.com/packs/modularcharacteroutfitsfantasy.html'],
  animation: ['Universal Animation Library 2[Standard]/Unreal-Godot/', 'https://quaternius.com/packs/universalanimationlibrary2.html'],
  monsters: ['Cute Animated Monsters - Aug 2020/glTF/', 'https://quaternius.com/packs/cutemonsters.html'],
  props: ['Fantasy Props MegaKit[Standard]/Exports/glTF/', 'https://quaternius.itch.io/fantasy-props-megakit'],
  village: ['Medieval Village MegaKit[Standard]/glTF/', 'https://quaternius.com/packs/medievalvillagemegakit.html'],
  nature: ['Stylized Nature MegaKit[Standard]/glTF/', 'https://quaternius.itch.io/stylized-nature-megakit'],
};
// Runtime IDs describe gameplay roles; sourcePath always preserves the original filename.
const entries = [
  ['Ranger', 'hero', 'Female_Ranger.gltf', 'character'],
  ['RangerAnimations', 'animation', 'UAL2_Standard.glb', 'animation-only'],
  ['Ninja', 'monsters', 'GreenDemon.gltf', 'character'],
  ['Demon', 'monsters', 'Demon.gltf', 'character'],
  ['Wizard', 'monsters', 'Cthulhu.gltf', 'character'],
  ['Dragon', 'monsters', 'YellowDragon.gltf', 'character'],
  ['Sword', 'props', 'Sword_Bronze.gltf', 'equipment'],
  ['Candles', 'props', 'CandleStick_Triple.gltf', 'environment'],
  ['Crate', 'props', 'Crate_Wooden.gltf', 'environment'],
  ['Ground', 'nature', 'RockPath_Square_Wide.gltf', 'environment'],
  ['Rock', 'nature', 'Rock_Medium_1.gltf', 'environment'],
  ['Pine', 'nature', 'Pine_1.gltf', 'environment'],
  ['Fern', 'nature', 'Fern_1.gltf', 'environment'],
  ['Paving', 'village', 'Floor_Brick.gltf', 'environment'],
  ['Pillar', 'village', 'Corner_Exterior_Brick.gltf', 'environment'],
  ['BrokenPillar', 'village', 'Prop_Brick4.gltf', 'environment'],
  ['Wall', 'village', 'Wall_UnevenBrick_Straight.gltf', 'environment'],
  ['Arch', 'village', 'Wall_UnevenBrick_Door_Round.gltf', 'environment'],
  ['Steps', 'village', 'Stairs_Exterior_Straight.gltf', 'environment'],
  ['Lantern', 'props', 'Torch_Metal.gltf', 'environment'],
  ['Banner', 'props', 'Banner_2.gltf', 'environment'],
  ['Well', 'props', 'Cauldron.gltf', 'environment'],
];
export const manifest = entries.map(([id, pack, name, role]) => ({
  id, role, author: 'Quaternius', license: 'CC0-1.0', repository, revision,
  sourcePath: packs[pack][0] + name, authorPage: packs[pack][1],
}));
export const excludedSnapshots = [
  {ref: 'develop', commit: '1ba1336a59ffc1818b77c9ecc279e7088a5bbc71'},
  {ref: 'work/nocturne-external-assets', commit: '98ed873338842e3a2f655314bdb20d2063ba107e'},
];
