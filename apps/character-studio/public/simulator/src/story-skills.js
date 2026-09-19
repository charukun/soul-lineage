/** A narrow bridge into the existing notebook; combat, conversion and ratios stay native. */
export function createStorySkills({readLibrary,readPools,weights,identity,assign,active,canEdit}) {
  const stages=['jo','ha','kyu'];
  return {
    learnedSkills(){
      const pools=readPools();
      return readLibrary().filter(r=>/^story-\d+-(attention|compassion|footwork|understanding)$/.test(r.id)).map(r=>({
        id:r.id,name:r.name,weapon:r.weapon,
        slots:stages.flatMap(stage=>(pools[stage]||[]).flatMap((v,index)=>v?.id===r.id?[{stage,index,weight:weights(stage)[index]}]:[])),
      }));
    },
    skillSlots(){const pools=readPools();return stages.flatMap(stage=>[0,1,2].map(index=>({stage,index,name:identity(pools[stage]?.[index]).jp,weight:weights(stage)[index]})));},
    assignLearnedSkill(id,stage,index){
      const recipe=readLibrary().find(r=>r.id===id&&/^story-\d+-(attention|compassion|footwork|understanding)$/.test(r.id));
      if(!canEdit()||!recipe||!stages.includes(stage)||!Number.isInteger(index)||index<0||index>2)return false;
      return assign(stage,index,recipe);
    },
    activeLearnedSkill(){const run=active();return run?.recipe?.id?.startsWith('story-')?{id:run.recipe.id,name:run.recipe.name,stage:run.slot}:null;},
  };
}
