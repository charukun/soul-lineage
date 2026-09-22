import {defs,ready} from './core.js';
import {muraFurnitureFits,muraHasInterior} from '@soul/world/mura';

/** Local mayor editor permission. This is separate from who may reside here.
 * Network clients must still use the authoritative housing service's permissions.
 * Preserve the local room editing scope enabled by the mobile housing updates.
 */
export function canEditRoom(world, roomId) {
  const host=world.object(roomId);
  return !!host&&ready(host)&&!!defs[host.kind]?.building&&muraHasInterior(host);
}

export function isFurnitureUnlocked(state, kind) {
  const d=defs[kind];
  return !!d?.furniture&&(d.unlock||[]).every(key=>state.known.includes(key));
}

export function availableFurniture(world, roomId, furniture) {
  const host=world.object(roomId);
  return canEditRoom(world,roomId)?furniture.filter(d=>isFurnitureUnlocked(world.state,d.id)&&muraFurnitureFits(host,d)):[];
}
