import {installShino25dGuest as installLegacyGuest} from './shino25d-legacy-guest.js';
import {installSpriteSetGuest} from './sprite-set-guest.js';

// Retain the existing bootstrap/query and legacy v1/v2 transfer protocol.
// The formal sprite set uses an independent, session-only protocol and runtime.
export function installShino25dGuest(view,options={}){
  if(new URLSearchParams(location.search).get('spriteSet')==='1')return installSpriteSetGuest(view,options);
  return installLegacyGuest(view,options);
}
