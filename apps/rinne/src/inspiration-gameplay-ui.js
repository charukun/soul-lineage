import { createGameplayUI as createBaseGameplayUI } from './gameplay-ui.js';
import { installInspirationUI } from './inspiration-journal-ui.js';
import { installInspirationCombatControls } from './inspiration-combat-controls.js';

/** Compose the life-owned journal with the existing world HUD without copying it. */
export function createGameplayUI(gameScreen,options){
  const ui=createBaseGameplayUI(gameScreen,options);
  return installInspirationCombatControls(installInspirationUI(ui,{gameScreen,audio:options.audio}),{gameScreen});
}
