import { deepFreeze, invariant, validateCharacter } from './master-character.js';
import { canonicalAppearanceParts } from './appearance-parts.js';
import { visualIdentityForCharacter } from './visual-identity.js';

export const CHARACTER_REFERENCE_ARCHETYPE_VERSION = 1;

const freezeList = rows => Object.freeze(rows.map(String));
const define = input => deepFreeze({
  version: CHARACTER_REFERENCE_ARCHETYPE_VERSION,
  ...input,
  profile: canonicalAppearanceParts(input.profile),
  contexts: [...input.contexts],
  coverage: {
    implementedModularParts: freezeList(input.coverage.implementedModularParts),
    proposedParts: freezeList(input.coverage.proposedParts),
    gameEquipment: freezeList(input.coverage.gameEquipment)
  }
});

export const CHARACTER_REFERENCE_ARCHETYPES = deepFreeze({
  'npc.child-boy.v1': define({ id:'npc.child-boy.v1', label:'Child Boy', role:'resident', age:7, contexts:['village','studio'], assetFile:'child-boy.avif', repositoryPath:'docs/characters/references/npc-role-set/child-boy.avif', profile:{version:1,face:'round',hair:'crop',body:'compact',outfit:'tunic',accessory:'none'}, hairFront:'fringe', hairBack:'close', coverage:{implementedModularParts:['face:round','hair:crop','body:compact','outfit:tunic','age:7'],proposedParts:['hooded village cape','short patchwork trousers','small treasure pouch'],gameEquipment:[]} }),
  'npc.child-girl.v1': define({ id:'npc.child-girl.v1', label:'Child Girl', role:'resident', age:7, contexts:['village','studio'], assetFile:'child-girl.avif', repositoryPath:'docs/characters/references/npc-role-set/child-girl.avif', profile:{version:1,face:'round',hair:'bun',body:'compact',outfit:'tunic',accessory:'ribbon'}, hairFront:'swept', hairBack:'tied', coverage:{implementedModularParts:['face:round','hair:bun','body:compact','outfit:tunic','accessory:ribbon','age:7'],proposedParts:['puffed village sleeves','layered floral dress hem','cross-body flower pouch'],gameEquipment:[]} }),
  'npc.elderly-man.v1': define({ id:'npc.elderly-man.v1', label:'Elderly Man', role:'resident', age:75, contexts:['village','studio'], assetFile:'elderly-man.avif', repositoryPath:'docs/characters/references/npc-role-set/elderly-man.avif', profile:{version:1,face:'long',hair:'crop',body:'slender',outfit:'mantle',accessory:'scarf'}, hairFront:'parted', hairBack:'layered', coverage:{implementedModularParts:['face:long','hair:crop','body:slender','outfit:mantle','accessory:scarf','role-gear:shawl','age:75'],proposedParts:['full white beard','fringed shawl trim','weathered pouch'],gameEquipment:['game-owned walking prop']} }),
  'npc.elderly-woman.v1': define({ id:'npc.elderly-woman.v1', label:'Elderly Woman', role:'resident', age:75, contexts:['village','studio'], assetFile:'elderly-woman.avif', repositoryPath:'docs/characters/references/npc-role-set/elderly-woman.avif', profile:{version:1,face:'round',hair:'bun',body:'compact',outfit:'mantle',accessory:'scarf'}, hairFront:'open', hairBack:'tied', coverage:{implementedModularParts:['face:round','hair:bun','body:compact','outfit:mantle','accessory:scarf','role-gear:shawl','age:75'],proposedParts:['apron floral hem','herb pouch','wispy authored gray-hair strands'],gameEquipment:['game-owned walking prop']} }),
  'npc.guard.v1': define({ id:'npc.guard.v1', label:'Guard', role:'guard', age:23, contexts:['village','demon','studio'], assetFile:'guard.avif', repositoryPath:'docs/characters/references/npc-role-set/guard.avif', profile:{version:1,face:'classic',hair:'crop',body:'sturdy',outfit:'tunic',accessory:'none'}, hairFront:'swept', hairBack:'close', coverage:{implementedModularParts:['face:classic','hair:crop','body:sturdy','outfit:tunic','role-gear:armor'],proposedParts:['blue-white guard tabard','armored greaves','village emblem'],gameEquipment:['game-owned guard equipment']} }),
  'npc.knight.v1': define({ id:'npc.knight.v1', label:'Knight', role:'knight', age:26, contexts:['demon','studio'], assetFile:'knight.avif', repositoryPath:'docs/characters/references/npc-role-set/knight.avif', profile:{version:1,face:'sharp',hair:'crop',body:'sturdy',outfit:'mantle',accessory:'none'}, hairFront:'swept', hairBack:'close', coverage:{implementedModularParts:['face:sharp','hair:crop','body:sturdy','outfit:mantle','role-gear:armor'],proposedParts:['ceremonial plate silhouette','long heraldic cape','knight crest'],gameEquipment:['game-owned knight equipment']} }),
  'npc.blacksmith.v1': define({ id:'npc.blacksmith.v1', label:'Blacksmith', role:'smith', age:32, contexts:['village','demon','studio'], assetFile:'blacksmith.avif', repositoryPath:'docs/characters/references/npc-role-set/blacksmith.avif', profile:{version:1,face:'sharp',hair:'crop',body:'sturdy',outfit:'apron',accessory:'headband'}, hairFront:'open', hairBack:'close', coverage:{implementedModularParts:['face:sharp','hair:crop','body:sturdy','outfit:apron','accessory:headband','role-gear:tools'],proposedParts:['forge-worn apron texture','heavy work gloves','authored tool-belt silhouette'],gameEquipment:['game-owned smithing tools']} }),
  'npc.laborer.v1': define({ id:'npc.laborer.v1', label:'Laborer', role:'laborer', age:28, contexts:['village','studio'], assetFile:'laborer.avif', repositoryPath:'docs/characters/references/npc-role-set/laborer.avif', profile:{version:1,face:'classic',hair:'crop',body:'sturdy',outfit:'tunic',accessory:'scarf'}, hairFront:'open', hairBack:'close', coverage:{implementedModularParts:['face:classic','hair:crop','body:sturdy','outfit:tunic','accessory:scarf','role-gear:pack'],proposedParts:['rolled work shirt','patched trousers','work towel'],gameEquipment:['game-owned work tools']} }),
  'npc.hunter.v1': define({ id:'npc.hunter.v1', label:'Hunter', role:'hunter', age:26, contexts:['village','demon','studio'], assetFile:'hunter.avif', repositoryPath:'docs/characters/references/npc-role-set/hunter.avif', profile:{version:1,face:'sharp',hair:'tail',body:'balanced',outfit:'tunic',accessory:'scarf'}, hairFront:'swept', hairBack:'tied', coverage:{implementedModularParts:['face:sharp','hair:tail','body:balanced','outfit:tunic','accessory:scarf','role-gear:quiver'],proposedParts:['asymmetric field cloak','authored hunter satchel','boot gaiters'],gameEquipment:['game-owned hunter equipment']} }),
  'npc.arcanist.v1': define({ id:'npc.arcanist.v1', label:'Arcanist', role:'arcanist', age:28, contexts:['demon','studio'], assetFile:'arcanist.avif', repositoryPath:'docs/characters/references/npc-role-set/arcanist.avif', profile:{version:1,face:'long',hair:'tail',body:'slender',outfit:'mantle',accessory:'glasses'}, hairFront:'parted', hairBack:'tied', coverage:{implementedModularParts:['face:long','hair:tail','body:slender','outfit:mantle','accessory:glasses','role-gear:cowl'],proposedParts:['arcane mantle embroidery','scroll tubes','ornate scholar satchel'],gameEquipment:['game-owned scholar equipment']} })
});

export function characterReferenceArchetype(id) {
  const row = CHARACTER_REFERENCE_ARCHETYPES[id];
  invariant(row, `Unknown character reference archetype: ${id}`);
  return row;
}

export function visualIdentityForReferenceArchetype(character, id, parts = null) {
  validateCharacter(character);
  const row = characterReferenceArchetype(id);
  const identity = visualIdentityForCharacter(character, { role: row.role, parts: parts ?? row.profile });
  return deepFreeze({ ...identity, front: row.hairFront, back: row.hairBack, referenceArchetypeId: row.id });
}
