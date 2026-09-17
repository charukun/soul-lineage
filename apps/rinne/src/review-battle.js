import {RaidHost} from '@soul/network/raid-host';
import {REVIEW_BATTLE_MODELS,createReviewBattleStage} from './review-battle-stage.js';

const q=id=>document.getElementById(id);
const heroSelect=q('battle-hero-model'),enemySelect=q('battle-enemy-model');
for(const select of [heroSelect,enemySelect])select.replaceChildren(...REVIEW_BATTLE_MODELS.map(row=>{const option=document.createElement('option');option.value=row.id;option.textContent=row.label;return option;}));
heroSelect.value='kaykit.rogue.v1';enemySelect.value='kaykit.knight.v1';

let battleStage=null,battleStagePromise=null;
async function ensureBattleStage(){
  if(battleStage)return battleStage;
  if(battleStagePromise)return battleStagePromise;
  q('battle-model-status').textContent='モデル準備中';
  battleStagePromise=createReviewBattleStage({canvas:q('battle-canvas'),onStatus:text=>{q('battle-model-status').textContent=text;}})
    .then(stage=>{battleStage=stage;stage.setModel('hero',heroSelect.value);stage.setModel('enemy',enemySelect.value);return stage;})
    .catch(error=>{q('battle-model-status').textContent=`モデル読込失敗 · ${error.message}`;q('battle-canvas').dataset.battleModels='failed';throw error;});
  return battleStagePromise;
}

heroSelect.addEventListener('change',()=>{void ensureBattleStage().then(stage=>stage.setModel('hero',heroSelect.value));});
enemySelect.addEventListener('change',()=>{void ensureBattleStage().then(stage=>stage.setModel('enemy',enemySelect.value));});

const memory=new Map();
const storage={getItem:key=>memory.has(key)?memory.get(key):null,setItem:(key,value)=>memory.set(key,String(value))};
let host=null,playing=true,last=performance.now(),lastCore=null;
function resetBattle(){
  memory.clear();lastCore=null;
  host=new RaidHost({villageId:'develop-visual-review',storage,now:()=>Date.now()});
  host.join('demon',{type:'join',app:'demon',role:'demon',playerId:'review-demon',name:'Demon'});
  host.join('human',{type:'join',app:'rinne',role:'human',playerId:'review-human',name:'Human'});
  host.input('demon',{type:'state',x:-1.2,z:0,yaw:Math.PI/2,state:'combat',action:null});
  host.input('human',{type:'state',x:1.2,z:0,yaw:-Math.PI/2,state:'combat',action:null});
  host.tick(1/60);lastCore=host.battle?.core?.state?.()||null;playing=true;q('battle-toggle').textContent='一時停止';last=performance.now();
}

function syncBattle(dt){
  const battle=host?.battle,currentCore=battle?.core?.state?.();if(currentCore)lastCore=currentCore;const core=currentCore||lastCore;if(!core)return;
  q('hero-action').textContent=core.hero.attack||'構え';q('enemy-action').textContent=core.enemy.attack||'構え';
  q('hero-hp').value=Math.max(0,core.hero.hp/core.hero.maxhp);q('enemy-hp').value=Math.max(0,core.enemy.hp/core.enemy.maxhp);
  q('hero-meta').textContent=`${Math.ceil(core.hero.hp)} / ${core.hero.maxhp} HP · ${core.hero.weapon}`;
  q('enemy-meta').textContent=`${Math.ceil(core.enemy.hp)} / ${core.enemy.maxhp} HP · ${core.enemy.weapon}`;
  q('battle-time').textContent=`${(battle?.time||0).toFixed(1)}秒`;
  q('battle-result').textContent=battle?.finished?`${battle.winner==='demon'?'LEFT':'RIGHT'} 勝利`:'戦闘中';
  battleStage?.sync(core,dt);
}

function frame(now){
  const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  if(playing&&host?.battle&&!host.battle.finished)host.tick(dt);
  syncBattle(dt);requestAnimationFrame(frame);
}

q('battle-restart').addEventListener('click',resetBattle);
q('battle-toggle').addEventListener('click',()=>{playing=!playing;q('battle-toggle').textContent=playing?'一時停止':'再開';last=performance.now();});
window.addEventListener('pagehide',()=>battleStage?.dispose(),{once:true});

resetBattle();void ensureBattleStage();requestAnimationFrame(frame);
