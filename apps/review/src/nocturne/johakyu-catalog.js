import {compileJohakyuCatalogTrial} from '@soul/johakyu-presentation/motion-bindings';
import {createJohakyuPhysiologyRules} from './johakyu-physiology.js';

export function createJohakyuCatalogRules({mind='balanced',loadout={}}={}){
  // This route remains an explicit sword review trial. Main-game equipment,
  // learned techniques and inspiration commits are supplied by Rinne, never
  // inferred from seeing this animation.
  const sequence=compileJohakyuCatalogTrial({weapon:'sword',loadout});
  const rules=createJohakyuPhysiologyRules({mind,loadout,sequence});
  return Object.freeze({...rules,catalogScope:'review-trial',sequence});
}
