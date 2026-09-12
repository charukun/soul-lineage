// Art manifest. Every visible mesh/texture comes from one of these pinned sources.
// World-art generation and hand-keyed motion fallbacks are forbidden; UI has its explicit exception.
export const PACKS={
 uiIcons:{repo:'lucide-icons/lucide',commit:'a79b2d131dab2bf20cb224bd0937b439a9c4fa99',base:'icons/',author:'Lucide Contributors; Feather Contributors',license:'ISC; Feather-derived glyphs MIT'},
 adventurers:{repo:'KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0',commit:'672074b73ba276876a19e8816ecdc5241817ab47',base:'addons/kaykit_character_pack_adventures/',author:'Kay Lousberg',license:'CC0-1.0'},
 skeletons:{repo:'KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0',commit:'15b62b9bad122f72926c10fb14d622c73819fa54',base:'addons/kaykit_character_pack_skeletons/',author:'Kay Lousberg',license:'CC0-1.0'},
 dungeon:{repo:'KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0',commit:'b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07',base:'addons/kaykit_dungeon_remastered/Assets/gltf/',author:'Kay Lousberg',license:'CC0-1.0'},
 medieval:{repo:'KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0',commit:'84fa4e91af6a88989be7c99e0891cede11f2ca38',base:'addons/kaykit_medieval_hexagon_pack/Assets/gltf/',author:'Kay Lousberg',license:'CC0-1.0'},
 ui:{repo:'RonenNess/RPGUI',commit:'048859e6e1a73bd8f5615555609db098beba4e9c',base:'dist/img/',author:'Ronen Ness; default artwork by Buch / Michele Bucelli',license:'Zlib; default theme art public domain as stated in README'},
 vfx:{repo:'Calinou/kenney-particle-pack',commit:'ab7086639ee73be31abd87feb21bf1402d4e8144',base:'addons/kenney_particle_pack/',author:'Kenney; packaging by Hugo Locurcio',license:'CC0-1.0'}
};
export const MODELS={
 knight:['adventurers','Characters/gltf/Knight.glb'],rogue:['adventurers','Characters/gltf/Rogue_Hooded.glb'],mage:['adventurers','Characters/gltf/Mage.glb'],barbarian:['adventurers','Characters/gltf/Barbarian.glb'],skeleton:['skeletons','Characters/gltf/Skeleton_Warrior.glb'],skeletonMage:['skeletons','Characters/gltf/Skeleton_Mage.glb'],
 grass:['medieval','tiles/base/hex_grass.gltf'],house:['medieval','buildings/green/building_home_A_green.gltf'],tavern:['medieval','buildings/green/building_tavern_green.gltf'],smith:['medieval','buildings/green/building_blacksmith_green.gltf'],well:['medieval','buildings/green/building_well_green.gltf'],tree:['medieval','decoration/nature/tree_single_A.gltf'],pine:['medieval','decoration/nature/tree_single_B.gltf'],rock:['medieval','decoration/nature/rock_single_A.gltf'],hill:['medieval','decoration/nature/hills_A_trees.gltf'],mountain:['medieval','decoration/nature/mountain_A_grass_trees.gltf'],plant:['medieval','decoration/nature/waterplant_A.gltf'],grain:['medieval','buildings/neutral/building_grain.gltf'],river:['medieval','tiles/rivers/hex_river_A.gltf'],bridge:['medieval','buildings/neutral/building_bridge_A.gltf'],fence:['medieval','buildings/neutral/fence_wood_straight.gltf'],
 stone:['dungeon','floor_tile_large.gltf.glb'],dirt:['dungeon','floor_dirt_large.gltf.glb'],woodFloor:['dungeon','floor_wood_large_dark.gltf.glb'],wall:['dungeon','wall_broken.gltf.glb'],arch:['dungeon','wall_arched.gltf.glb'],pillar:['dungeon','pillar_decorated.gltf.glb'],barrel:['dungeon','barrel_small.gltf.glb'],crates:['dungeon','crates_stacked.gltf.glb'],bed:['dungeon','bed_floor.gltf.glb'],table:['dungeon','table_small.gltf.glb'],chair:['dungeon','chair.gltf.glb'],lantern:['dungeon','torch_lit.gltf.glb'],shelf:['dungeon','shelf_large.gltf.glb'],cloth:['dungeon','banner_green.gltf.glb'],chest:['dungeon','chest_gold.glb']
};
export const TEXTURES={spark:['vfx','spark_01.png'],magic:['vfx','magic_01.png'],slash:['vfx','slash_01.png'],circle:['vfx','circle_01.png'],smoke:['vfx','smoke_01.png'],star:['vfx','star_01.png'],flame:['vfx','flame_01.png']};
export const UI_FILES=['menu','sword','heart','sparkles','flask-conical','book-open','backpack','hammer','map','house','settings-2','compass','chevron-right','shield','crosshair','x','moon'].map(n=>n+'.svg');
export function sourceURL(pack,path){const p=PACKS[pack];if(!p)throw new Error('Unregistered art source: '+pack);return `https://raw.githubusercontent.com/${p.repo}/${p.commit}/${p.base}${path}`;}
export function assetURL(spec){return sourceURL(...spec);}
export const CLASS_MODEL={warden:'knight',ranger:'rogue',mage:'mage',mender:'mage',bard:'mage',lancer:'barbarian'};
export const MODIFICATIONS={
 models:'Source meshes and texture atlases retained; scale, placement, palette tint and selection of provided equipment are adapted. Source banner is rotated into a rug; source barrel plus waterplant become a planter.',
 animation:'Only embedded authored clips. AnimationMixer cross-fades, playback speed and state selection; no handwritten bone animation.',
 environment:'Source terrain, buildings, trees and props rearranged into four original areas. Repeated meshes use GPU instancing without creating new geometry.',
 ui:'Original portrait glass HUD and touch controls under the user-approved UI-only exception; Lucide source SVGs used without redrawing. RPGUI/Buch artwork is no longer loaded.',
 vfx:'Kenney PNG sprites tinted, scaled and timed to combat. No procedural sprite artwork.',
 audio:'Original synthesized audio has been removed. Licensed music and audio replacement is pending; this preview is silent.'
};
