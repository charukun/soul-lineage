export const FOUNDING_GUIDE_VERSION=5;
export const FOUNDING_MEMBER_IDS=Object.freeze(['mayor-npc','guard-npc','logger-npc','carpenter-npc']);

function person(id,name,role,x,z,extra={}){
 return{id,name,homeId:null,x,z,role,source:role==='mayor'?'avatar-npc':'local-npc',jobId:null,task:'idle',timer:999,path:[],hunger:88,purse:0,health:100,happiness:82,skill:0,seed:extra.seed||1,angle:0,insideId:null,status:'新しい土地へ向かっています',favorite:extra.favorite||'焚き火の語らい',memories:[],remoteControlled:true,...extra};
}

export function prepareFreshFoundingVillage(world){
 const state=world.state;
 state.objects=[];
 state.people=[
  person('mayor-npc','村長','mayor',-52,34,{seed:1,favorite:'焚き火の語らい'}),
  person('guard-npc','アルド','guard',-50,36,{seed:8,favorite:'村長のそばで見張る'}),
  person('logger-npc','木こり','resident',-55,37,{seed:12,favorite:'木立を眺める',foundingVocation:'logger'}),
  person('carpenter-npc','大工','resident',-53,39,{seed:16,favorite:'道具の手入れ',foundingVocation:'carpenter'}),
 ];
 state.nextId=Math.max(4,state.nextId||4);
 state.tutorial={dismissed:false,completed:false};
 state.onboarding={...(state.onboarding||{}),founding:{version:FOUNDING_GUIDE_VERSION,arrivalSeen:false,completed:false}};
 world.history=[];world.future=[];world.changed();
 return state.onboarding.founding;
}

export function foundingArrivalComplete(world){
 const founding=world.state.onboarding?.founding;
 return founding?.version===FOUNDING_GUIDE_VERSION&&!!founding.arrivalSeen;
}

export function markFoundingArrivalSeen(world){
 world.state.onboarding={...(world.state.onboarding||{}),founding:{...(world.state.onboarding?.founding||{}),version:FOUNDING_GUIDE_VERSION,arrivalSeen:true,completed:false}};
 world.changed();
}

export function bindFoundingPlacement(world,kind,object){
 if(!object)return;
 const people=world.people;
 const homes={mayor:'mayor-npc',guardhome:'guard-npc',loggerhome:'logger-npc',carpenterhome:'carpenter-npc'};
 const personId=homes[kind];
 if(personId){const p=people.find(person=>person.id===personId);if(p)p.homeId=object.id;}
 if(kind==='logging'){const p=people.find(person=>person.id==='logger-npc');if(p){p.jobId=object.id;p.jobAssignedAt=0;}}
 if(kind==='carpenter'){const p=people.find(person=>person.id==='carpenter-npc');if(p){p.jobId=object.id;p.jobAssignedAt=0;}}
 world.changed();
}

export function completeFounding(world){
 const state=world.state;
 state.tutorial={...(state.tutorial||{}),completed:true,dismissed:false};
 state.onboarding={...(state.onboarding||{}),founding:{...(state.onboarding?.founding||{}),version:FOUNDING_GUIDE_VERSION,arrivalSeen:true,completed:true}};
 for(const p of state.people)if(FOUNDING_MEMBER_IDS.includes(p.id)){p.remoteControlled=false;p.timer=1;p.task='idle';p.status=p.id==='guard-npc'?'村長のそばで村を見守っています':p.jobId?'仕事を始める準備をしています':'新しい村を見渡しています';}
 world.changed();
}
