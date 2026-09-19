import { createGameplayUI as createBaseGameplayUI } from './gameplay-ui-base.js';
import { installInspirationUI } from './inspiration-journal-ui.js';

/** Compose the world HUD with the life-owned causal journal. No review fixture enters a save. */
export function createGameplayUI(gameScreen,options){
  const ui=createBaseGameplayUI(gameScreen,options);
  return installInspirationUI(ui,{gameScreen,audio:options.audio});
}
