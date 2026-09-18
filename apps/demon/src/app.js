import { loadVillage } from '@soul/world';
import { contentVersion } from '@soul/game-data';
// Portable application initialization. No DOM, browser storage or SDK calls.
export function createApp(platform) {
  return { world: loadVillage(), contentVersion, language: platform.locale.language };
}
