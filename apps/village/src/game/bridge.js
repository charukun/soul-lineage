import {defs,ready,entry,capacityOf} from './core.js';
/** Residence boundary only. Authentication/authority/transport belong to the real host.
 * This is not an authentication implementation and never claims to be connected.
 */
export class PlayerResidenceBridge{
 constructor(world){this.world=world;}
 upsert(snapshot,{demo=false}={}){const w=this.world;
  if(!snapshot||typeof snapshot.id!=='string'||snapshot.id.length>64||typeof snapshot.name!=='string'||snapshot.name.length>40||typeof snapshot.clanId!=='string'||snapshot.clanId.length>80)return{error:'一族プレイヤー情報が不正です'};
  const source=demo?'local-player-demo':'rinne-player',id=(demo?'demo:':'rinne:')+snapshot.id;
  let p=w.people.find(p=>p.id===id),home=w.object(snapshot.homeId||p?.homeId);
  if(!home)home=w.objects.find(o=>ready(o)&&defs[o.kind].clanOnly&&w.people.filter(n=>n.homeId===o.id).length<capacityOf(o));
  if(!home||!ready(home)||!defs[home.kind].clanOnly)return{error:'完成した一族専用の邸宅が必要です'};
  if(w.people.filter(n=>n.id!==id&&n.homeId===home.id).length>=capacityOf(home))return{error:'その邸宅は満室です'};
  if(!p&&w.people.length>=64)return{error:'この体験版の表示上限に達しています'};
  if(!p){const e=entry(home);p={id,name:snapshot.name,clanId:snapshot.clanId,source,role:'player',homeId:home.id,jobId:null,x:e.x,z:e.z,health:100,hunger:85,happiness:82,purse:30,skill:10,task:'idle',timer:0,path:[],seed:3,memories:[],favorite:'一族の部屋を飾る'};w.people.push(p);}
  Object.assign(p,{name:snapshot.name,clanId:snapshot.clanId,homeId:home.id,source,remoteControlled:!demo});w.changed();return{ok:true,person:p};
 }
 remove(id){const p=this.world.people.find(p=>p.id===id&&['rinne-player','local-player-demo'].includes(p.source));if(!p)return{error:'対象の一族プレイヤーが見つかりません'};this.world.people.splice(this.world.people.indexOf(p),1);this.world.changed();return{ok:true};}
}
