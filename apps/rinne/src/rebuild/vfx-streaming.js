const BASIC_BY_WEAPON=Object.freeze({fist:'basic.fist',sword:'basic.sword',dagger:'basic.dagger',great:'basic.great',spear:'basic.spear',axe:'basic.axe',staff:'basic.staff'});
const ATTACK_SKILL=/^(?:basic\.|action\.)/;

const addSkill=(set,value)=>{if(typeof value==='string'&&value.length<=120)set.add(value);};

export function equippedVfxSkillIds(state){
  const ids=new Set();
  addSkill(ids,BASIC_BY_WEAPON[state?.equipment?.weapon]||'basic.fist');
  const loadout=state?.combatLoadout,heart=loadout?.heart,technique=loadout?.technique;
  for(const id of heart?.active||[])addSkill(ids,id);
  const combos=Array.isArray(technique?.combos)?technique.combos:[];
  const combo=combos.find(row=>row?.id===technique?.activeComboId)||combos[0];
  for(const id of Object.values(combo?.slots||{}))addSkill(ids,id);
  addSkill(ids,technique?.oneMotion);
  return [...ids].slice(0,16);
}

export function vfxEffectsForSkills(skillIds,effectDefinitions={}){
  const skills=new Set((Array.isArray(skillIds)?skillIds:[]).filter(id=>typeof id==='string'));
  const available=new Set(Object.keys(effectDefinitions||{})),effects=new Set();
  for(const [effect,definition] of Object.entries(effectDefinitions||{})){
    const attached=definition?.skillIds||definition?.skills;
    if(Array.isArray(attached)&&attached.some(id=>skills.has(id)))effects.add(effect);
  }
  for(const skill of skills){
    if(ATTACK_SKILL.test(skill)){
      if(available.has('slash'))effects.add('slash');
      if(available.has('impact'))effects.add('impact');
    }
    if(skill==='action.finish'&&available.has('finisher'))effects.add('finisher');
  }
  return [...effects];
}

export function vfxAffinityEffectsForState(state,effectDefinitions={}){
  const available=new Set(Object.keys(effectDefinitions||{})),effects=new Set();
  for(const skill of equippedVfxSkillIds(state)){
    const affinity=state?.inspiration?.records?.[skill]?.effectAffinity,key=affinity?`affinity-${affinity}`:'';
    if(key&&available.has(key))effects.add(key);
  }
  return [...effects];
}

export function createVfxStreamingDemand({self,peers=[],effectDefinitions={},nearDistance=15,warmDistance=40}={}){
  if(!self?.position)return[];
  const demand=new Map();
  const add=(skills,priority)=>{
    for(const effect of vfxEffectsForSkills(skills,effectDefinitions)){
      const previous=demand.get(effect)||0;
      if(priority>previous)demand.set(effect,priority);
    }
  };
  add(equippedVfxSkillIds(self),100);
  for(const effect of vfxAffinityEffectsForState(self,effectDefinitions))demand.set(effect,Math.max(demand.get(effect)||0,110));
  for(const peer of Array.isArray(peers)?peers:[]){
    const p=peer?.position;
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.z))continue;
    const distance=Math.hypot(p.x-self.position.x,p.z-self.position.z);
    if(distance>warmDistance)continue;
    const priority=distance<=nearDistance?80:45;
    add(Array.isArray(peer.vfxSkills)?peer.vfxSkills:equippedVfxSkillIds(peer),priority);
    for(const effect of vfxAffinityEffectsForState(peer,effectDefinitions))demand.set(effect,Math.max(demand.get(effect)||0,priority+5));
  }
  return [...demand].map(([effect,priority])=>({effect,priority})).sort((a,b)=>b.priority-a.priority||a.effect.localeCompare(b.effect));
}
