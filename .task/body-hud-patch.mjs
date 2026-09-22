import fs from 'node:fs';
function replace(file,before,after){let text=fs.readFileSync(file,'utf8');if(text.includes(after))return;if(text.split(before).length!==2)throw new Error(`Expected one patch anchor in ${file}`);fs.writeFileSync(file,text.replace(before,after));}
replace('apps/rinne/src/review/battle/entrypoint.js',"import {createCombatBodyHud} from '../../combat-body-hud.js';","import {createCombatBodyHud} from '../../combat-body-hud.js';\nimport {applyReviewBodyPreset} from './body-hud-presets.js';");
replace('apps/rinne/src/review/battle/entrypoint.js',"if(reviewInjury!=='none'&&role==='hero')state.injuries[reviewInjury]={severity:.72,at:0};","if(role==='hero')applyReviewBodyPreset(state,reviewInjury);");
const html='apps/rinne/review-battle.html';
let text=fs.readFileSync(html,'utf8');
const composition='    <div id="battle-technique-composition" class="technique-composition" aria-label="段・技・連・序破急の構成"></div>\n';
if(!text.includes('class="body-hud-review-composition"')){
  if(text.split(composition).length!==2)throw new Error('composition anchor changed');
  text=text.replace(composition,'').replace('      <div class="review-settings-body">','      <div class="review-settings-body">\n        <details class="body-hud-review-composition"><summary>技の構成・試演</summary>\n'+composition+'        </details>');
  fs.writeFileSync(html,text);
}
replace(html,'<option value="none">なし</option>','<option value="none">なし</option><option value="body-stages">身体HUD・全損傷段階</option><option value="head">頭重傷</option>');
const css='apps/rinne/src/review/battle/index.css';
if(!fs.readFileSync(css,'utf8').includes('/* Body charm: reserve the upper-left'))fs.appendFileSync(css,'\n/* Body charm: reserve the upper-left for live injury state. Composition remains available in the existing settings dialog. */\n.body-hud-review-composition{grid-column:1/-1;min-width:0;padding:8px;border:1px solid #bda57538;border-radius:8px;background:#15262366}\n.body-hud-review-composition>summary{padding:6px;color:#e2d4b5;cursor:pointer;font-size:13px}\n.body-hud-review-composition .technique-composition{position:static;display:grid;gap:6px;width:100%;max-width:100%;padding-top:8px}\n');
