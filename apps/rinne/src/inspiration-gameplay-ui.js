import {createGameplayUI as createBaseGameplayUI} from './gameplay-ui.js';
import {installInspirationUI} from './inspiration-journal-ui.js';
import {installInspirationCombatControls} from './inspiration-combat-controls.js';
import {installStorybookUI} from './storybook-ui.js';

/** Keep the existing life-owned journal and battle contracts behind the approved core pages. */
export function createGameplayUI(gameScreen,options){
  const ui=createBaseGameplayUI(gameScreen,options);
  const journal=installInspirationCombatControls(installInspirationUI(ui,{gameScreen,audio:options.audio}),{gameScreen});
  return installStorybookUI(journal,{gameScreen,audio:options.audio,requestEquip:options.requestEquip});
}
