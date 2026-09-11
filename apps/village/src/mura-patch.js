import { THREE as T } from '@soul/rendering';
import { World, defs, FURNITURE, isPlayer, isGuard } from './game/core.js';
import { Simulation } from './game/simulation.js';
import { View } from './web/view.js';
import { threeWorlds150 } from '@soul/audio';

const EFFECT_LABELS={rest:'休息',comfort:'快適',meal:'食事',skill:'技能',social:'交流'};
const FURNITURE_RULES={
 dirtbed:{label:'土の寝床',w:2.1,d:3.0,unlock:[],trait:'土と藁をならした最低限の寝床。村の始まりにふさわしい質素な休息場所。',effects:{rest:3}},
 chair:{unlock:['wood'],trait:'腰を落ち着けるだけの素朴な椅子。',effects:{comfort:1}},
 bench:{unlock:['plank'],trait:'何人かで腰掛けられ、短い語らいが生まれます。',effects:{comfort:1,social:1}},
 table:{unlock:['plank'],trait:'食事を囲む場所。家での食事と交流を少し良くします。',effects:{meal:4,social:1}},
 bed:{unlock:['plank','cloth'],trait:'布と板材で作る寝床。十分な休息を取れます。',effects:{rest:12,comfort:2}},
 shelf:{unlock:['plank'],trait:'道具や記録をしまう棚。暮らしの技能が少し伸びやすくなります。',effects:{skill:.7,comfort:1}},
 counter:{unlock:['plank'],trait:'調理や作業の段取りを整える台。',effects:{meal:2,skill:.3}},
 workbench:{unlock:['plank','metal'],trait:'手仕事のための作業台。家での技能習熟を助けます。',effects:{skill:1.2}},
 hearth:{unlock:['stone','clay'],trait:'石と粘土で囲った炉。暖かさが休息と気分を支えます。',effects:{rest:4,comfort:3}},
 rug:{unlock:['cloth'],trait:'床の冷えをやわらげる敷物。',effects:{comfort:3}},
 plant:{unlock:['clay','seed'],trait:'部屋に季節の気配を持ち込む鉢植え。',effects:{comfort:2}},
 lamp:{unlock:['clay'],trait:'夜の手仕事や読書を助ける灯り。',effects:{skill:.3,comfort:1}},
 sofa:{unlock:['cloth','plank'],trait:'余裕のある家で作れる上等な長椅子。',effects:{comfort:5,rest:2}}
};

function installFurnitureRules(){
 if(!FURNITURE.some(item=>item.id==='dirtbed'))FURNITURE.unshift({id:'dirtbed',category:'家具',furniture:true,...FURNITURE_RULES.dirtbed});
 for(const item of FURNITURE){
  const rule=FURNITURE_RULES[item.id]||{unlock:['plank'],trait:'暮らしに役立つ家具。',effects:{comfort:1}};
  Object.assign(item,{unlock:[...(rule.unlock||[])],trait:rule.trait,effects:{...(rule.effects||{})}});
  defs[item.id]={...(defs[item.id]||{}),...item};
 }
}
installFurnitureRules();

export function furnitureUnlocked(state,kind){
 const d=defs[kind];
 return !!d?.furniture&&(d.unlock||[]).every(key=>state.known.includes(key));
}
export function furnitureEffectText(kind){
 const e=defs[kind]?.effects||{};
 return Object.entries(e).map(([key,value])=>`${EFFECT_LABELS[key]||key}+${value}`).join(' · ');
}
function clanRoom(world,roomId){const host=world.object(roomId);return !!host&&!!defs[host.kind]?.clanOnly;}
function roomDenied(world,roomId){return roomId&&!clanRoom(world,roomId);}

const originalAdd=World.prototype.add;
World.prototype.add=function(kind,x,z,rot=0,roomId=null,options={}){
 if(roomDenied(this,roomId))return{error:'NPCの住まいは住人自身がハウジングします'};
 if(roomId&&!furnitureUnlocked(this.state,kind))return{error:'まだ作れない家具です。素材との出会いを待ちましょう'};
 return originalAdd.call(this,kind,x,z,rot,roomId,options);
};
const originalMove=World.prototype.move;
World.prototype.move=function(id,x,z,rot,roomId=null){
 if(roomDenied(this,roomId))return{error:'NPCの住まいは住人自身が整えます'};
 return originalMove.call(this,id,x,z,rot,roomId);
};
const originalRemove=World.prototype.remove;
World.prototype.remove=function(id,roomId=null){
 if(roomDenied(this,roomId))return{error:'NPCの家具は住人自身の持ち物です'};
 return originalRemove.call(this,id,roomId);
};
World.prototype.roomEffects=function(homeId,ownerId=null){
 const home=this.object(homeId),sum={rest:0,comfort:0,meal:0,skill:0,social:0};
 if(!home?.room)return sum;
 for(const item of home.room){
  if(ownerId&&item.ownerId&&item.ownerId!==ownerId)continue;
  const effects=defs[item.kind]?.effects||{};
  for(const key of Object.keys(sum))sum[key]+=Number(effects[key]||0);
 }
 return sum;
};

function ensureStarterBed(world,p){
 if(!p||isPlayer(p)||!p.homeId)return;
 const home=world.object(p.homeId);
 if(!home?.room||home.phase==='planned')return;
 const owned=home.room.filter(item=>!item.ownerId||item.ownerId===p.id);
 if(owned.some(item=>(defs[item.kind]?.effects?.rest||0)>0))return;
 world.furnish(p,'dirtbed');
}
const originalStep=Simulation.prototype.step;
Simulation.prototype.step=function(dt){
 this.__muraHomeTick=(this.__muraHomeTick||0)-dt;
 if(this.__muraHomeTick<=0){for(const p of this.world.people)ensureStarterBed(this.world,p);this.__muraHomeTick=8;}
 return originalStep.call(this,dt);
};
const originalFinish=Simulation.prototype.finish;
Simulation.prototype.finish=function(p){
 const completed=p?.task;
 const result=originalFinish.call(this,p);
 if(!p?.homeId)return result;
 const fx=this.world.roomEffects(p.homeId,p.id);
 if(completed==='rest'||completed==='home'){
  p.health=Math.min(100,p.health+(fx.rest||0)*.35);
  p.happiness=Math.min(100,p.happiness+(fx.comfort||0)*.45);
  p.skill=Math.min(100,p.skill+(fx.skill||0)*.08);
 }
 if(completed==='eat'){
  p.hunger=Math.min(100,p.hunger+(fx.meal||0)*.6);
  p.happiness=Math.min(100,p.happiness+(fx.social||0)*.4);
 }
 return result;
};

const dirtMaterials={
 soil:new T.MeshStandardMaterial({color:0x876b4e,roughness:1,metalness:0}),
 straw:new T.MeshStandardMaterial({color:0xc7a66a,roughness:1,metalness:0}),
 wood:new T.MeshStandardMaterial({color:0x6f533b,roughness:.96,metalness:0})
};
function box(group,x,y,z,w,h,d,material){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;}
function dirtBed(){
 const group=new T.Group();
 box(group,0,.08,0,2.0,.16,2.8,dirtMaterials.soil);
 box(group,0,.18,.1,1.75,.18,2.45,dirtMaterials.straw);
 box(group,-.93,.18,0,.12,.22,2.85,dirtMaterials.wood);box(group,.93,.18,0,.12,.22,2.85,dirtMaterials.wood);
 for(let i=0;i<7;i++){const strand=box(group,-.7+i*.23,.30,-.2+(i%2)*.15,.035,.035,2.0,dirtMaterials.straw);strand.rotation.y=(i%3-1)*.07;}
 return group;
}
const originalGetProp=View.prototype.getProp;
View.prototype.getProp=function(kind){if(kind==='dirtbed')return dirtBed();return originalGetProp.call(this,kind);};

function guardArmor(node){
 if(!node||node.userData.muraGuardArmor)return;
 node.userData.muraGuardArmor=true;node.scale.setScalar(1.14);
 const body=node.userData.body||node,gear=new T.Group();gear.name='MURAAAAAAA_GuardGear';body.add(gear);
 const steel=new T.MeshStandardMaterial({color:0x45515a,roughness:.68,metalness:.42}),iron=new T.MeshStandardMaterial({color:0x252c31,roughness:.58,metalness:.55}),leather=new T.MeshStandardMaterial({color:0x4b3329,roughness:.9,metalness:0});
 const helmet=new T.Mesh(new T.SphereGeometry(.38,10,8,0,Math.PI*2,0,Math.PI*.62),steel);helmet.position.set(0,1.78,-.02);helmet.scale.y=.78;gear.add(helmet);
 const crest=new T.Mesh(new T.BoxGeometry(.07,.28,.5),leather);crest.position.set(0,2.02,-.08);gear.add(crest);
 for(const x of[-.39,.39]){const shoulder=new T.Mesh(new T.SphereGeometry(.18,8,6),steel);shoulder.position.set(x,1.26,0);shoulder.scale.set(1.35,.65,1);gear.add(shoulder);}
 const breast=new T.Mesh(new T.BoxGeometry(.67,.58,.18),steel);breast.position.set(0,1.15,-.22);breast.rotation.x=-.08;gear.add(breast);
 const shaft=new T.Mesh(new T.CylinderGeometry(.026,.026,2.35,7),leather);shaft.position.set(.56,1.25,.18);shaft.rotation.z=-.05;gear.add(shaft);
 const tip=new T.Mesh(new T.ConeGeometry(.10,.34,6),iron);tip.position.set(.62,2.50,.18);tip.rotation.z=-.05;gear.add(tip);
 const shield=new T.Mesh(new T.CylinderGeometry(.49,.49,.11,10),steel);shield.position.set(-.60,1.08,.12);shield.rotation.x=Math.PI/2;gear.add(shield);
}
const originalSyncActor=View.prototype.syncActor;
View.prototype.syncActor=function(p,time,monster=false){
 const result=originalSyncActor.call(this,p,time,monster);
 const node=this.actorNodes.get(p.id);
 if(!monster&&isGuard(p))guardArmor(node);else if(node&&!node.userData.muraGuardArmor)node.scale.setScalar(1);
 return result;
};

let lastView=null;
function ensureModeUi(){
 if(document.getElementById('focusMode'))return;
 document.body.insertAdjacentHTML('beforeend',`<aside id="focusMode" class="muraMode glass" hidden><span class="muraModeDot"></span><span><b>住人に注目中</b><small id="focusModeName"></small></span><button id="focusStop" aria-label="注目をやめる">×</button></aside><aside id="housingMode" class="muraMode glass" hidden><span class="muraModeDot"></span><span><b id="housingModeTitle"></b><small id="housingModeText"></small></span></aside>`);
 document.getElementById('focusStop').onclick=()=>{if(lastView){lastView.followId=null;lastView.lastInteraction=performance.now();}};
}
function refreshCatalog(view){
 const roomId=view.roomId,host=roomId?view.world.object(roomId):null,editable=!!host&&!!defs[host.kind]?.clanOnly;
 for(const card of document.querySelectorAll('#catalog .card')){
  const kind=card.dataset.kind;if(!kind||!defs[kind]?.furniture)continue;
  const unlocked=furnitureUnlocked(view.world.state,kind);
  card.hidden=!!roomId&&(!editable||!unlocked);
  if(editable&&unlocked){const small=card.querySelector('small');if(small)small.textContent=furnitureEffectText(kind)||defs[kind].trait;card.title=defs[kind].trait||'';}
 }
}
function refreshModes(view){
 ensureModeUi();lastView=view;
 const focus=document.getElementById('focusMode'),name=document.getElementById('focusModeName');
 const p=view.followId?view.world.people.find(person=>person.id===view.followId):null;
 focus.hidden=!p;if(p)name.textContent=p.name||'住人';
 const housing=document.getElementById('housingMode'),build=document.getElementById('build'),host=view.roomId?view.world.object(view.roomId):null;
 if(!host){housing.hidden=true;if(build)build.hidden=false;return;}
 housing.hidden=false;const editable=!!defs[host.kind]?.clanOnly;
 document.getElementById('housingModeTitle').textContent=editable?'一族の住まい':'住人の住まい';
 document.getElementById('housingModeText').textContent=editable?'ハウジング可能':'見学のみ · 住人が自分で整えます';
 housing.classList.toggle('readonly',!editable);if(build)build.hidden=!editable;
 refreshCatalog(view);
}
const originalRender=View.prototype.render;
View.prototype.render=function(time,dt){const result=originalRender.call(this,time,dt);refreshModes(this);return result;};

// Runtime contract for the shared soundtrack. Playback/UI are provided by the
// repository-wide shared music library installed by the village bootstrap.
window.__MURAAAAAAA__={title:'MURAAAAAAA',soundtrack:threeWorlds150,furnitureEffects:FURNITURE_RULES};
