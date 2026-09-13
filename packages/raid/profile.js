import {PREY,FORMS} from './world.js';
export const SAVE_KEY='kurai.nighthunt.v2';
export class SaveError extends Error {}
const life=(number,bornAt)=>({number,bornAt,hunts:0,eaten:0,battles:0,powers:[],moves:[]});
const allKnownMoves=p=>[...new Set(Object.values(p.adaptations||{}).flatMap(a=>Array.isArray(a.moves)?a.moves:[]))];
function ensureEvolution(p,now){
 if(p.adaptations===undefined)p.adaptations={};
 if(!p.adaptations||Array.isArray(p.adaptations)||typeof p.adaptations!=='object')throw new SaveError('戦闘学習の記録が壊れています。上書きせず停止しました。');
 for(const [role,a] of Object.entries(p.adaptations))if(!Object.hasOwn(PREY,role)||!a||!Number.isSafeInteger(a.encounters)||a.encounters<0||!Array.isArray(a.moves)||a.moves.some(m=>typeof m!=='string'||!m||m.length>80)||!Number.isFinite(a.lastSeenAt||0))throw new SaveError('戦闘学習の記録が壊れています。上書きせず停止しました。');
 if(p.lives===undefined)p.lives=[];
 if(!Array.isArray(p.lives)||p.lives.length>64)throw new SaveError('転生史を確認できません。上書きせず停止しました。');
 if(p.currentLife===undefined)p.currentLife=life((p.lives.at(-1)?.number||0)+1,now);
 const c=p.currentLife;
 if(!c||!Number.isSafeInteger(c.number)||c.number<1||!Number.isFinite(c.bornAt)||!Number.isSafeInteger(c.hunts)||c.hunts<0||!Number.isSafeInteger(c.eaten)||c.eaten<0||!Number.isSafeInteger(c.battles)||c.battles<0||!Array.isArray(c.powers)||!Array.isArray(c.moves))throw new SaveError('現在の生の記録を確認できません。上書きせず停止しました。');
 return p;
}
function strongestForm(p){let form='hollow';for(const [key,f] of Object.entries(FORMS))if(p.unlocked.length>=f.need&&f.need>=FORMS[form].need)form=key;return form;}
export function freshProfile(id,now=Date.now()){return ensureEvolution({version:2,id,revision:0,sequence:0,visits:{},unlocked:[],equipped:[],form:'hollow',hunts:0,totalEaten:0,offers:[],imported:null,echo:null,adaptations:{},lives:[],currentLife:life(1,now)},now);}
export function validateProfile(p){if(!p||p.version!==2||typeof p.id!=='string'||!p.id||!Number.isSafeInteger(p.sequence)||p.sequence<0||!Number.isSafeInteger(p.revision)||!p.visits||Array.isArray(p.visits)||typeof p.visits!=='object'||!Array.isArray(p.unlocked)||!Array.isArray(p.equipped)||p.equipped.length>3||new Set(p.equipped.filter(Boolean)).size!==p.equipped.filter(Boolean).length||p.equipped.some(k=>k!==null&&(!p.unlocked.includes(k)||typeof k!=='string'))||!Array.isArray(p.offers)||p.revision<0||!Number.isSafeInteger(p.hunts)||p.hunts<0||!Number.isSafeInteger(p.totalEaten)||p.totalEaten<0||!Object.hasOwn(FORMS,p.form)||p.unlocked.some(k=>!Object.hasOwn(PREY,k))||new Set(p.unlocked).size!==p.unlocked.length)throw new SaveError('保存データを確認できません。上書きせず停止しました。');
 for(const [id,v] of Object.entries(p.visits))if(!id||!v||v.villageId!==id||!['entered','escaped','defeated','abandoned','completed'].includes(v.status))throw new SaveError('入村記録が壊れています。再訪防止のため入村を停止しました。');return p;}
export class ProfileStore {
 constructor(storage,idFactory=()=>{throw new SaveError('IDポートがありません。');},now=()=>Date.now()){this.storage=storage;this.idFactory=idFactory;this.now=now;}
 read(){let raw;try{raw=this.storage.getItem(SAVE_KEY);}catch{throw new SaveError('保存領域を利用できません。入村記録を残せないため開始できません。');}if(raw===null){const p=freshProfile(this.idFactory(),this.now());this.write(p);return p;}try{return ensureEvolution(validateProfile(JSON.parse(raw)),this.now());}catch(e){throw e instanceof SaveError?e:new SaveError('保存データの読み込みに失敗しました。データは削除していません。');}}
 write(p){ensureEvolution(p,this.now());validateProfile(p);const raw=JSON.stringify(p);try{this.storage.setItem(SAVE_KEY,raw);if(this.storage.getItem(SAVE_KEY)!==raw)throw new Error();}catch{throw new SaveError('入村記録を保存できません。空き容量と保存権限を確認してください。');}return p;}
 change(fn){const p=this.read();const result=fn(p);p.revision++;this.write(p);return result;}
 claim(village){if(!village||typeof village.id!=='string'||!village.id||village.id.length>200||['__proto__','constructor','prototype'].includes(village.id))throw new SaveError('村の識別子がありません。');return this.change(p=>{if(Object.hasOwn(p.visits,village.id))throw new SaveError('喰痕が残っている。ここはもう開かない。');p.visits[village.id]={villageId:village.id,name:village.name,status:'entered',enteredAt:this.now()};p.offers=[];return p.visits[village.id];});}
 finish(id,outcome,eaten){if(!['escaped','defeated','completed','abandoned'].includes(outcome)||!Number.isSafeInteger(eaten)||eaten<0)throw new SaveError('狩りの結果が不正です。');return this.change(p=>{const v=p.visits[id];if(!v||v.status!=='entered')return false;v.status=outcome;v.eaten=eaten;p.hunts++;p.currentLife.hunts++;p.currentLife.eaten+=eaten;if(outcome==='defeated'){p.lives.push({...p.currentLife,endedAt:this.now(),status:'defeated',form:p.form,knownPowers:[...p.unlocked],knownMoves:allKnownMoves(p)});if(p.lives.length>48)p.lives.splice(0,p.lives.length-48);p.currentLife=life(p.currentLife.number+1,this.now());}return true;});}
 abandonInterrupted(){if(!Object.values(this.read().visits).some(v=>v.status==='entered'))return;this.change(p=>{for(const v of Object.values(p.visits))if(v.status==='entered')v.status='abandoned';});}
 unlock(key){if(!Object.hasOwn(PREY,key))throw new SaveError('存在しない特能です。');return this.change(p=>{const first=!p.unlocked.includes(key);if(first){p.unlocked.push(key);p.currentLife.powers.push(key);const empty=p.equipped.findIndex(k=>!k);if(empty>=0)p.equipped[empty]=key;else if(p.equipped.length<3)p.equipped.push(key);p.form=strongestForm(p);}p.totalEaten++;return first;});}
 learn(role,move){if(!Object.hasOwn(PREY,role)||typeof move!=='string'||!move||move.length>80)throw new SaveError('覚えられない動きです。');return this.change(p=>{const a=p.adaptations[role]||={encounters:0,moves:[],lastSeenAt:0};a.encounters++;a.lastSeenAt=this.now();const first=!a.moves.includes(move);if(first)a.moves.push(move);p.currentLife.battles++;if(first&&!p.currentLife.moves.includes(move))p.currentLife.moves.push(move);return first;});}
 equip(key,index){return this.change(p=>{if(!p.unlocked.includes(key)||!Number.isInteger(index)||index<0||index>2)throw new SaveError('装着できない記憶です。');const old=p.equipped.indexOf(key);if(old>=0){[p.equipped[old],p.equipped[index]]=[p.equipped[index],p.equipped[old]];}else p.equipped[index]=key;p.equipped=Array.from(p.equipped,k=>k||null);});}
}
