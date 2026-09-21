import {createBattleRuntime} from './runtime.js';
export {createBattleRuntime};
/** The native scene is shared; the main game supplies every authoritative frame. */
export function createDrivenBattleRuntime(options){
  let driver;
  createBattleRuntime({...options,presentationPort:{install:value=>{driver=value;}}});
  if(!driver)throw Error('Canonical presentation port is unavailable');
  return driver;
}

export {techniquePresentationRevision,resolveTechniquePresentation,techniquePresentationEffectIds} from './technique-presentation.js';
