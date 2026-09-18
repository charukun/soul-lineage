import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LIFE_YEARS, createLife, rebirth } from '../src/rebuild/domain.js';
import { equipmentAccess, requestEquipmentChange, objectiveNavigation, rebirthPreview } from '../src/rebuild/gameplay-contract.js';
import { ensureCombatLoadout, learnedHeartSkills, learnedTechniqueSkills } from '../src/combat-loadout.js';

const weaponRack=()=>({id:'rack.sword',label:'武具棚',x:0,z:0,equipment:{weapon:'sword',shield:true},equipmentRadius:1.55});
const armorStand=()=>({id:'armor.light',label:'軽装鎧置き場',x:0,z:0,armor:'light',equipmentAccess:true,equipmentRadius:1.45});
function adultLife(){
  const state=createLife({name:'旅人',seed:42,villageIds:['village-a']});
  state.phase='living';state.ageSeconds=8*60;state.ageYears=8;state.position={x:0,z:0};
  state.inventory={weapons:['fist','sword'],armors:['cloth','light'],shields:[false,true]};
  return state;
}

test('canonical life contract is 100 years',()=>{assert.equal(LIFE_YEARS,100);});

test('equipment changes are rejected when age, place, combat, ownership, or station-kind rules fail',()=>{
  const rack=weaponRack();
  const child=adultLife();child.ageSeconds=6*60;child.ageYears=6;
  assert.equal(equipmentAccess(child,{stations:[rack]}).ok,false);
  const away=adultLife();away.position={x:9,z:9};
  assert.equal(equipmentAccess(away,{stations:[rack]}).ok,false);
  const fighting=adultLife();fighting.combat={targetId:'enemy'};
  assert.equal(equipmentAccess(fighting,{stations:[rack]}).ok,false);
  const adult=adultLife();
  assert.equal(requestEquipmentChange(adult,{kind:'weapon',value:'axe',stations:[rack]}).ok,false);
  assert.equal(requestEquipmentChange(adult,{kind:'weapon',value:'sword',stations:[armorStand()]}).ok,false);
  const changed=requestEquipmentChange(adult,{kind:'weapon',value:'sword',stations:[rack]});
  assert.equal(changed.ok,true);assert.equal(changed.changed,true);assert.equal(adult.equipment.weapon,'sword');
  assert.ok(adult.knownSkills.includes('basic.sword'));
  const armor=requestEquipmentChange(adult,{kind:'armor',value:'light',stations:[armorStand()]});
  assert.equal(armor.ok,true);assert.equal(adult.equipment.armor,'light');
});

test('combat editor reads the game-owned catalog instead of inventing candidates',()=>{
  const state=adultLife();state.combatCatalog=['skill.breath','action.lunge'];ensureCombatLoadout(state);
  assert.deepEqual(learnedHeartSkills(state),['skill.breath']);
  const techniques=learnedTechniqueSkills(state);
  assert.ok(techniques.includes('basic.fist'));assert.ok(techniques.includes('action.lunge'));assert.ok(!techniques.includes('action.counter'));
});

test('objective navigation preserves the same target id for HUD and map',()=>{
  const state=adultLife();state.yaw=0;const navigation=objectiveNavigation(state,{target:{id:'port',label:'港',x:10,z:0}});
  assert.equal(navigation.targetId,'port');assert.equal(navigation.distance,10);assert.match(navigation.text,/港/);
});

test('rebirth preview matches the reset/persist behavior of the domain',()=>{
  const state=adultLife();state.homelands=['village-a'];state.lineage=[{generation:0,name:'先代'}];state.equipment={weapon:'sword',armor:'light',shield:true};state.experiences={practice:{score:4,count:4}};
  const preview=rebirthPreview(state,{villageLabel:'故郷'});assert.equal(preview.lifeYears,100);assert.ok(preview.preserved.some(text=>text.includes('一族の記録')));assert.ok(preview.preserved.some(text=>text.includes('故郷')));assert.ok(preview.reset.some(text=>text.includes('装備')));
  const next=rebirth(state,{villageId:'village-a',villageIds:['village-a']});assert.equal(next.ageYears,0);assert.equal(next.equipment.weapon,'fist');assert.deepEqual(next.experiences,{});assert.deepEqual(next.homelands,['village-a']);assert.equal(next.lineage.length,2);
});

test('main UI exposes heart technique body equipment plus a top-right radar without direct equipment mutation',async()=>{
  const ui=await readFile(new URL('../src/gameplay-ui.js',import.meta.url),'utf8'),loadoutUi=await readFile(new URL('../src/heart-technique-body-ui.js',import.meta.url),'utf8'),detail=await readFile(new URL('../src/selection-detail.js',import.meta.url),'utf8'),detailCss=await readFile(new URL('../src/selection-detail.css',import.meta.url),'utf8'),upgrade=await readFile(new URL('../src/gameplay-upgrade.js',import.meta.url),'utf8'),css=await readFile(new URL('../src/gameplay-ui-contract.css',import.meta.url),'utf8'),navy=await readFile(new URL('../src/dark-navy-hud.css',import.meta.url),'utf8'),index=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(ui,/data-heart/);assert.match(ui,/data-techniques/);assert.match(loadoutUi,/SIGIL_PATHS/);assert.match(loadoutUi,/skill-sigil/);assert.doesNotMatch(loadoutUi,/setHeartSlot|HEART_SLOT_COUNT|heartSlot/);assert.match(loadoutUi,/heart-learned-list/);assert.match(detail,/HOLD_MS=430/);assert.match(detail,/pointerdown/);assert.match(detail,/detailTitle/);assert.match(detailCss,/selection-detail-view/);assert.match(detailCss,/装着枠/);assert.match(ui,/installSelectionDetail/);assert.match(ui,/decorateSelectionDetail/);assert.match(ui,/data-body/);assert.match(ui,/data-items/);assert.match(ui,/class=\"rinne-map-radar\"/);assert.match(ui,/data-record/);assert.match(ui,/function toggle\(type,options=\{\}\)/);assert.match(ui,/ui\.heart\.onclick=\(\)=>toggle\('heart'/);assert.doesNotMatch(ui,/data-debug/);assert.doesNotMatch(ui,/state\.equipment\.(weapon|armor|shield)\s*=/);assert.doesNotMatch(upgrade,/data-debug/);assert.match(css,/\.upgrade-panel\{overflow:hidden!important/);assert.match(navy,/\.game-screen\[data-gameplay-upgrade\] \.combat-phase-indicator\[hidden\]\{display:none!important\}/);assert.match(navy,/bottom:max\(82px,calc\(env\(safe-area-inset-bottom\) \+ 78px\)\)!important/);assert.match(navy,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);assert.match(navy,/\.skill-sigil\{/);assert.match(navy,/border-radius:0!important/);assert.match(navy,/\.upgrade-panel>header>\[data-close\]\{display:none!important\}/);assert.match(index,/reincarnation-interface-v2\.css/);
});

test('record UI uses readable life experience labels and an explicit four-rate world clock selector',async()=>{
  const ui=await readFile(new URL('../src/gameplay-ui.js',import.meta.url),'utf8'),css=await readFile(new URL('../src/gameplay-record-alignment.css',import.meta.url),'utf8'),index=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(ui,/EXPERIENCES\[kind\]\|\|kind/);assert.match(ui,/record-tabs/);assert.match(ui,/time-rate-panel/);assert.match(ui,/\[1,5,10,20\]/);assert.match(ui,/clock\.onchange/);assert.doesNotMatch(ui,/state\.clockRate\s*=/);assert.match(css,/\.record-tabs/);assert.match(css,/\.time-rate-panel/);assert.match(index,/gameplay-record-alignment\.css/);
});
