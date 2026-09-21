import {defs,unlocked} from './catalog.js';

const BUILD_SITES={
  tent:[-12,8],
  logging:[-20,-15],
  wheat:[-6,-24],
  guardpost:[-5,16],
  storage:[12,-10],
  quarry:[24,-10],
  carpenter:[8,-18],
};

function buildAction(world,kind,label='見にいく'){
  if(!defs[kind]||!unlocked(world.state,kind))return null;
  return{type:'build',kind,at:BUILD_SITES[kind]||null,label};
}

function guidance(id,title,text,action=null){
  return{id,label:'村の気配',title,text,action};
}

function idleResident(world){
  return world.people.find(person=>!person.dead&&!person.jobId&&!['mayor','guard'].includes(person.role));
}

function suggestedWorkKind(world){
  const candidates=['logging','storage','wheat','quarry','carpenter']
    .filter(kind=>unlocked(world.state,kind))
    .map((kind,index)=>({kind,index,count:world.objects?.filter(object=>object.kind===kind).length||0}));
  return candidates.sort((a,b)=>a.count-b.count||a.index-b.index)[0]?.kind||null;
}

export function nextVillageGuidance(world){
  if(!world||world.tutorialStep?.())return null;

  if(world.state?.defense?.raid?.phase==='warning'){
    return guidance(
      'raid-warning',
      '村の外が、少し騒がしい……',
      '襲来に備えて、警備職と守りの届く範囲を確かめておきたい。',
      buildAction(world,'guardpost','守りを整える'),
    );
  }

  const population=world.population();
  const freeBeds=Math.max(0,population.openBeds-population.people);
  if(freeBeds<1){
    const kind=unlocked(world.state,'home')?'home':'tent';
    return guidance(
      'housing',
      '寝床を探している住人がいるようだ……',
      '次の住人を迎える余白もない。暮らせる場所をもう少し増やしたい。',
      buildAction(world,kind,'住まいをつくる'),
    );
  }
  if(population.safety<=population.people){
    return guidance(
      'safety',
      '村が広がり、守りが薄くなってきた……',
      '人の暮らす範囲に警備の目を増やすと、次の住人も安心して来られる。',
      buildAction(world,'guardpost','守りをつくる'),
    );
  }
  if(population.food<=population.people){
    return guidance(
      'food',
      '食卓が、少し寂しくなってきた……',
      '住人が増えたぶん、食べものを生み出す場所を増やしたい。',
      buildAction(world,'wheat','食べものを増やす'),
    );
  }

  const resident=idleResident(world);
  if(resident){
    const kind=suggestedWorkKind(world);
    const facility=kind&&defs[kind];
    return guidance(
      'work',
      `${resident.name}は、仕事を欲しているようだ……`,
      facility?`${facility.label}があれば、新しい働き口と村の生産が生まれる。`:'新しい働き口があれば、村の暮らしがもう一段動き出しそうだ。',
      kind?buildAction(world,kind,'仕事場をつくる'):null,
    );
  }

  return guidance(
    'stable',
    '村は、いま穏やかに回っている。',
    '住人の暮らしを眺めながら、内装や景観を整える余裕がありそうだ。',
  );
}

export function nextVillageGoal(world){
  const next=nextVillageGuidance(world);
  return next?`${next.title} ${next.text}`:null;
}
