const DEFENSE_KINDS=new Set(['fence','wall','guardpost','watchtower','wardlamp']);
const DEFENSE_RANK={fence:1,hedge:1,wall:2,guardpost:2,watchtower:3,wardlamp:3,barracks:3};
const SECTORS={
 east:{id:'east',label:'東側',x:1,z:0},
 west:{id:'west',label:'西側',x:-1,z:0},
 north:{id:'north',label:'北側',x:0,z:1},
 south:{id:'south',label:'南側',x:0,z:-1},
};

function center(world){
 const fire=world.objects?.find(o=>o.kind==='campfire');
 if(fire)return{x:Number(fire.x)||0,z:Number(fire.z)||0};
 const homes=(world.objects||[]).filter(o=>['mayor','guardhome','tent','home','lodge','clanManor'].includes(o.kind));
 if(!homes.length)return{x:0,z:0};
 return{x:homes.reduce((n,o)=>n+(Number(o.x)||0),0)/homes.length,z:homes.reduce((n,o)=>n+(Number(o.z)||0),0)/homes.length};
}
function sectorFromPoint(world,point){
 const c=center(world),dx=(Number(point?.x)||0)-c.x,dz=(Number(point?.z)||0)-c.z;
 if(Math.abs(dx)>=Math.abs(dz))return dx>=0?SECTORS.east:SECTORS.west;
 return dz>=0?SECTORS.north:SECTORS.south;
}
function proposalKind(world,score){
 const known=world.state?.known||[];
 if(score>=3&&known.includes('stone'))return'wall';
 if(known.includes('wood'))return'fence';
 return null;
}
function nearbyDefenseSatisfies(world,proposal){
 const required=DEFENSE_RANK[proposal.kind]||1;
 return (world.objects||[]).some(o=>{
  if(!DEFENSE_KINDS.has(o.kind))return false;
  if((DEFENSE_RANK[o.kind]||1)<required)return false;
  return Math.hypot((Number(o.x)||0)-proposal.x,(Number(o.z)||0)-proposal.z)<=10;
 });
}

export function activeDefenseProposal(world){
 const p=world?.state?.defense?.proposal;
 if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.z)||!['fence','wall'].includes(p.kind))return null;
 if(nearbyDefenseSatisfies(world,p))return null;
 return p;
}

export function recordDefensePressure(world,point,{source='raid',weight=1}={}){
 if(!world?.state?.defense||!Number.isFinite(point?.x)||!Number.isFinite(point?.z)||!Number.isFinite(weight)||weight<=0)return{proposal:null,created:false};
 const defense=world.state.defense,sector=sectorFromPoint(world,point),day=Number(world.state.clock)||0;
 const pressure=Array.isArray(defense.pressure)?defense.pressure.filter(r=>r&&SECTORS[r.sector]&&Number.isFinite(r.score)): [];
 let record=pressure.find(r=>r.sector===sector.id);
 if(!record){record={sector:sector.id,score:0,events:0,lastDay:day};pressure.push(record);}
 record.score=Math.min(9,record.score+weight);record.events=(record.events||0)+1;record.lastDay=day;
 defense.pressure=pressure.slice(-4);
 const kind=proposalKind(world,record.score);
 if(record.score<2||!kind)return{proposal:activeDefenseProposal(world),created:false};
 const c=center(world),radius=kind==='wall'?29:25,guard=world.people?.find(p=>p.id==='guard-npc')||world.people?.find(p=>p.role==='guard');
 const next={sector:sector.id,side:sector.label,x:c.x+sector.x*radius,z:c.z+sector.z*radius,kind,score:record.score,day,source,guardId:guard?.id||null,guardName:guard?.name||'警備職'};
 const current=activeDefenseProposal(world),created=!current||current.sector!==next.sector||current.kind!==next.kind;
 defense.proposal=next;
 return{proposal:next,created};
}

export function warningGuardPost(world,raid,guard,index=0){
 const approach=raid?.approach||raid?.monsters?.[0];
 if(!approach||!Number.isFinite(approach.x)||!Number.isFinite(approach.z))return null;
 const c=center(world),dx=approach.x-c.x,dz=approach.z-c.z,length=Math.hypot(dx,dz)||1,ux=dx/length,uz=dz/length;
 const offset=((Number(index)||0)%3-1)*4;
 const x=c.x+ux*22-uz*offset,z=c.z+uz*22+ux*offset;
 const side=sectorFromPoint(world,approach).label;
 return{x,z,side,guardId:guard?.id||null};
}
