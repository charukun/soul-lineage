import { createGameplayUI as createBaseGameplayUI } from './gameplay-ui-base.js';
import { installInspirationUI } from './inspiration-journal-ui.js';
import { installInspirationCombatControls } from './inspiration-combat-controls.js';

/** Keep the world HUD and established combat controls around the life-owned journal. */
export function createGameplayUI(gameScreen,options){
  const ui=createBaseGameplayUI(gameScreen,options);
  return installInspirationCombatControls(installInspirationUI(ui,{gameScreen,audio:options.audio}),{gameScreen});
}
