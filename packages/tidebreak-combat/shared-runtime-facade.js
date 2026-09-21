const EXTRA_WEAPONS=Object.freeze({
  dagger:Object.freeze({label:'短剣',mesh:'sword',tip:1.08,base:.14,width:.065,power:.84,speed:1.18,ideal:1.02,two:false}),
  staff:Object.freeze({label:'杖',mesh:'spear',tip:1.82,base:.38,width:.075,power:.92,speed:.98,ideal:1.62,two:true})
});
const VISUAL_BACK=Object.freeze({sword:-.26,great:-.45,axe:-.43,spear:-.69,katana:-.35,dagger:-.19,staff:-.56});
const MODES=new Set(['duel','guard','evade','group','dummy']);
const frozenPoint=values=>Object.freeze([...values]);

export function installSharedTidebreakWeaponProfiles(weapons){
  for(const [id,row] of Object.entries(EXTRA_WEAPONS))weapons[id]={...row};
  return weapons;
}

export function sharedPommelContact({actor,pose,matrix,tp,fallback}){
  if(!['dagger','staff'].includes(actor?.weapon)||pose?.kind!=='pommel')return fallback();
  const back=VISUAL_BACK[actor.weapon];
  return{a:tp(matrix,[0,back+.18,0]),b:tp(matrix,[0,back-.035,0]),radius:.135};
}

export function createSharedTidebreakFacade({copy,clamp,weapons,strikes,sampleWeapon,actorPose,tp,attackProgress,poseChannels,onImpact}){
  let serial=0,lastImpact=null,stepImpacts=[],slowRemaining=0,slowScale=1,context=null,heroPassive=false;
  function resetFeel(){serial=0;lastImpact=null;stepImpacts=[];slowRemaining=0;slowScale=1;context=null;}
  function beginStep(){stepImpacts=[];}
  function setHeroPassive(value){heroPassive=Boolean(value);}
  function shouldHoldHero(actor){return heroPassive&&Boolean(actor?.hero);}
  function opponent(value){return MODES.has(value)?value:'duel';}
  function weaponSpec(id){
    const w=weapons[id];if(!w)return null;
    return Object.freeze({id,label:w.label,tip:w.tip,base:w.base,width:w.width,ideal:w.ideal,power:w.power,speed:w.speed,two:Boolean(w.two),fist:Boolean(w.fist)});
  }
  function weaponSegment(actor){
    const w=weapons[actor?.weapon]||weapons.sword;
    try{
      const sample=sampleWeapon(actor,actor?.attack?.t??null,actor.x,actor.z),pose=actorPose(actor,actor?.attack?.t??null,actor.x,actor.z);
      const visualBase=actor.weapon==='fist'?sample.a:tp(pose.sm,[0,VISUAL_BACK[actor.weapon]??0,0]),visualTip=sample.b;
      return Object.freeze({weapon:actor.weapon,base:frozenPoint(sample.a),tip:frozenPoint(sample.b),visualBase:frozenPoint(visualBase),visualTip:frozenPoint(visualTip),radius:Number(sample.radius??w.width)||w.width,ideal:w.ideal,active:Boolean(sample.active)});
    }catch{
      const x=Number(actor?.x)||0,z=Number(actor?.z)||0;
      return Object.freeze({weapon:actor?.weapon||'sword',base:frozenPoint([x,.8,z]),tip:frozenPoint([x,1.6,z]),visualBase:frozenPoint([x,.8,z]),visualTip:frozenPoint([x,1.6,z]),radius:w.width,ideal:w.ideal,active:false});
    }
  }
  function execution(actor,segment=null){
    const attack=actor?.attack,run=actor?.run;
    if(!attack)return null;
    return Object.freeze({attackId:attack.id,kind:attack.kind,weapon:actor.weapon,
      recipeId:run?.recipe?.id??null,recipeName:run?.recipe?.name??null,phase:run?.slot??null,
      stepIndex:Number.isInteger(run?.index)?run.index:null,targetId:attack.targetId??null,
      progress:attackProgress(actor),motionDuration:attack.motionDuration??attack.duration,
      elapsed:attack.t,duration:attack.duration,chargeTime:attack.chargeTime??0,
      charge:run?.recipe?.steps?.[run.index]?.charge??'none',contactActive:(segment??weaponSegment(actor)).active});
  }
  function snapshotActor(actor){
    const segment=weaponSegment(actor);
    return{id:actor.id,execution:execution(actor,segment),x:actor.x,z:actor.z,yaw:actor.yaw,hp:actor.hp,maxhp:actor.maxhp,dead:actor.dead,weapon:actor.weapon,attack:actor.attack?.kind??null,progress:attackProgress(actor),charge:actor.attack?.chargeTime??0,combatReady:actor.combatReady,flash:actor.flash,walk:actor.walk,moveSpeed:actor.moveSpeed,stun:actor.stun,guarding:actor.guarding,slot:actor.run?.slot??null,skill:actor.run?.recipe?.name??null,pose:poseChannels(actor),flow:actor.flow?copy(actor.flow):null,knockback:Object.freeze({x:Number(actor.kx)||0,z:Number(actor.kz)||0}),reaction:Boolean(actor.reaction||actor.recovery),weaponSegment:segment};
  }
  function syncActor(actor,row){
    if(!actor||!row)return;
    if(Number.isFinite(row.x))actor.x=clamp(row.x,-7.6,7.6);
    if(Number.isFinite(row.z))actor.z=clamp(row.z,-5.4,5.4);
    if(Number.isFinite(row.yaw))actor.yaw=row.yaw;
    if(Number.isFinite(row.maxhp)&&row.maxhp>0)actor.maxhp=row.maxhp;
    if(Number.isFinite(row.hp))actor.hp=clamp(row.hp,0,actor.maxhp);
  }
  function withHitContext(source,target,attack,action){
    context={source,target,attack};
    try{return action();}finally{context=null;}
  }
  function impact({x,y,z,yaw,power,guard,hitstop}){
    const source=context?.source,target=context?.target,attack=context?.attack,heavy=Number(power)>=1.1||(strikes[attack?.kind]?.damage||0)>=36;
    const freeze=guard?.025:heavy?.045:.018,slowSeconds=guard?.035:heavy?.095:.060,nextSlowScale=guard?.72:heavy?.38:.56;
    slowRemaining=Math.max(slowRemaining,slowSeconds);slowScale=Math.min(slowScale,nextSlowScale);
    lastImpact=Object.freeze({serial:++serial,x,y,z,point:frozenPoint([x,y,z]),yaw,power:Number(power)||0,guard:Boolean(guard),heavy,sourceId:source?.id??null,targetId:target?.id??null,sourceHero:Boolean(source?.hero),targetHero:Boolean(target?.hero),attack:attack?.kind??null,attackId:attack?.id??null,execution:execution(source),knockback:Object.freeze({x:Number(target?.kx)||0,z:Number(target?.kz)||0}),sourceKick:Number(source?.contactKick)||0,freezeSeconds:freeze,slowSeconds,slowScale:nextSlowScale});
    stepImpacts.push(lastImpact);if(stepImpacts.length>8)stepImpacts.shift();onImpact?.(copy(lastImpact));
    return Math.max(Number(hitstop)||0,freeze);
  }
  function simulationDt(dt,hitstop){
    const step=Math.min(1/30,Math.max(0,Number(dt)||0));if(hitstop>0)return step;
    if(slowRemaining<=0)return step;
    slowRemaining=Math.max(0,slowRemaining-step);const scaled=step*slowScale;if(slowRemaining<=0)slowScale=1;return scaled;
  }
  function feel(hitstop){return Object.freeze({hitstopRemaining:Number(hitstop)||0,slowRemaining,slowScale:slowRemaining>0?slowScale:1});}
  function impactState(){return{impact:lastImpact?copy(lastImpact):null,impacts:copy(stepImpacts)};}
  resetFeel();
  return Object.freeze({resetFeel,beginStep,setHeroPassive,shouldHoldHero,opponent,weaponSpec,weaponSpecs:()=>Object.freeze(Object.fromEntries(Object.keys(weapons).map(id=>[id,weaponSpec(id)]))),snapshotActor,syncActor,withHitContext,impact,simulationDt,feel,impactState});
}
