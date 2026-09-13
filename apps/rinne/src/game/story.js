import {storyPlaces} from './story-world.js';
/** Main-game rules. The existing Tidebreak LifeClock is the sole clock owner.
 * No renderer, storage, RNG, browser or simulator dependency crosses this boundary. */
export const GIFTS = {bell:'小さな鈴', stone:'丸い石', feather:'白い羽根'};
export const PLACES = storyPlaces();
export const EXPERIENCES = {study:'学び',read:'読書',pray:'祈り',care:'世話',play:'運動',observe:'観察',track:'追跡'};
const DISCOVERIES = [
  {id:'attention',name:'観察からの閃き',needs:{observe:2,study:2}},
  {id:'compassion',name:'守りの閃き',needs:{care:2,pray:2}},
  {id:'footwork',name:'足運びの閃き',needs:{play:2,track:2}},
  {id:'understanding',name:'読書からの閃き',needs:{read:3,study:2}},
];
const copy = value => JSON.parse(JSON.stringify(value));
const finite = (n,min=0,max=1e12) => typeof n==='number' && Number.isFinite(n) && n>=min && n<=max;
const names=['灯','澪','朔','凪','椿','律','翠','蓮','藍','楓','柊','紬'];
function newborn(generation=1,worldSeconds=0){
  return {version:1,generation,phase:'birth',zone:'village',bornAt:worldSeconds,lastWorld:worldSeconds,
    gifts:[],experiences:Object.fromEntries(Object.keys(EXPERIENCES).map(k=>[k,0])),discoveries:[],pendingDiscoveries:[],
    activity:null,resting:false,downedSeconds:0,front:0,cleared:false,departedAt:null,returnAt:0,
    rescue:null,rescued:0,victories:0,history:[],events:[],residents:names.map((name,i)=>({id:`resident-${i}`,name,bornAt:worldSeconds-(12+i*5)*60}))};
}
export class Story {
  constructor(saved=null,layout){this.state=saved?Story.validate(saved):newborn();this.places=storyPlaces(layout);}
  setWorld(layout){this.places=storyPlaces(layout);}
  static validate(raw){
    const s=copy(raw);
    if(s?.version!==1||!Number.isInteger(s.generation)||s.generation<1||!['birth','living','ended'].includes(s.phase)||!['village','frontier'].includes(s.zone))throw Error('本編の保存形式を確認できません。');
    for(const key of ['bornAt','lastWorld','downedSeconds','returnAt','rescued','victories'])if(!finite(s[key]))throw Error('本編の数値が不正です。');
    if(s.lastWorld<s.bornAt||!Number.isInteger(s.front)||s.front<0||s.front>5||typeof s.cleared!=='boolean'||typeof s.resting!=='boolean'||!(s.departedAt===null||finite(s.departedAt)))throw Error('本編の進行状態が不正です。');
    if(!Array.isArray(s.gifts)||s.gifts.length>2||new Set(s.gifts).size!==s.gifts.length||s.gifts.some(k=>!Object.hasOwn(GIFTS,k)))throw Error('持ち物が不正です。');
    if(Object.keys(EXPERIENCES).some(k=>!finite(s.experiences?.[k],0,1e7)))throw Error('生活経験が不正です。');
    for(const k of ['discoveries','pendingDiscoveries'])if(!Array.isArray(s[k])||new Set(s[k]).size!==s[k].length||s[k].some(id=>!DISCOVERIES.some(d=>d.id===id)))throw Error('閃きの記録が不正です。');
    if(s.pendingDiscoveries.some(id=>!s.discoveries.includes(id)))throw Error('未受領の閃きが不正です。');
    if(s.activity!==null&&(!Object.hasOwn(EXPERIENCES,s.activity?.kind)||!finite(s.activity.remaining,0,8)||typeof s.activity.place!=='string'))throw Error('生活行動が不正です。');
    if(s.rescue!==null&&(!['waiting','carried','safe'].includes(s.rescue?.status)||!finite(s.rescue.x,-8,8)||!finite(s.rescue.z,-6,6)))throw Error('救助状態が不正です。');
    if(!Array.isArray(s.history)||s.history.length>100||s.history.some(h=>!Number.isInteger(h.generation)||!finite(h.worldEnd)||!finite(h.rescued)||!finite(h.victories)||typeof h.memento!=='string'||h.memento.length>160))throw Error('生涯の記録が不正です。');
    if(s.phase==='ended'&&s.history[0]?.generation!==s.generation)throw Error('終えた生涯の記録がありません。');
    if(!Array.isArray(s.events)||s.events.length>40||s.events.some(e=>typeof e!=='string'||e.length>200))throw Error('出来事の記録が不正です。');
    if(!Array.isArray(s.residents)||s.residents.length>30||s.residents.some(r=>typeof r.id!=='string'||typeof r.name!=='string'||r.name.length>30||!finite(r.bornAt,-10000)))throw Error('村人の記録が不正です。');
    if(s.phase==='birth'&&s.zone!=='village')throw Error('出生場所が不正です。');
    return s;
  }
  snapshot(){return copy(this.state);}
  log(text){this.state.events.unshift(text);this.state.events.length=Math.min(40,this.state.events.length);return text;}
  nearest(position){return this.places.reduce((a,p)=>Math.hypot(p.x-position.x,p.z-position.z)<Math.hypot(a.x-position.x,a.z-position.z)?p:a);}
  near(place,position){return Math.hypot(place.x-position.x,place.z-position.z)<=2.2;}
  gift(id){const s=this.state;if(s.phase!=='birth'||!Object.hasOwn(GIFTS,id)||s.gifts.includes(id)||s.gifts.length>=2)return false;s.gifts.push(id);this.log(`母から${GIFTS[id]}を受け取った。`);return true;}
  release(){if(this.state.phase!=='birth')return false;this.state.phase='living';this.state.activity=null;this.log('母に見送られて、村での暮らしが始まった。');return true;}
  canDepart(life){const s=this.state;return s.phase==='living'&&s.zone==='village'&&life.ageYears>=15&&life.worldSeconds>=s.returnAt&&Math.floor(life.worldSeconds/60)%5===0;}
  nextDeparture(life){let year=Math.floor(life.worldSeconds/60);year=Math.max(year,Math.ceil((saneAgeWait(life)+life.worldSeconds)/60),Math.ceil(this.state.returnAt/60));return Math.ceil(year/5)*5;}
  startActivity(kind,place,frame){const s=this.state;if(s.phase!=='living'||s.zone!=='village'||frame.hero.dead||s.activity||!Object.hasOwn(EXPERIENCES,kind))return false;
    const p=this.places.find(p=>p.id===place);if(p?(!this.near(p,frame.hero)||p.activity!==kind):!['observe','track'].includes(kind))return false;
    s.activity={kind,place,remaining:8};s.resting=false;return true;
  }
  travel(frame){const s=this.state;if(frame.hero.dead||s.phase!=='living')return false;const port=this.places.find(p=>p.id==='port');
    if(s.zone==='village'){if(!this.canDepart(frame.life)||!this.near(port,frame.hero))return false;s.zone='frontier';s.front=0;s.cleared=false;s.departedAt=frame.life.worldSeconds;s.rescue={status:'waiting',x:1,z:-3};this.log('船に乗り、第一前線へ向かった。');}
    else {if(!this.near({x:-5,z:3},frame.hero))return false;s.zone='village';s.returnAt=frame.life.worldSeconds+60;s.rescue=null;this.log('村へ帰還した。次の出航まで少なくとも一年を過ごす。');}
    s.activity=null;s.resting=false;return true;
  }
  nextFront(frame){const s=this.state;if(s.zone!=='frontier'||!s.cleared||frame.hero.dead||s.front>=5||s.rescue?.status==='carried')return false;s.front++;s.cleared=false;s.rescue={status:'waiting',x:1,z:-3};this.log(s.front===5?'最終前線へ。将との戦いが始まる。':`第${s.front+1}前線へ進んだ。`);return true;}
  rescue(frame){const s=this.state,r=s.rescue;if(s.zone!=='frontier'||!r||r.status==='safe'||frame.hero.dead)return false;
    if(r.status==='waiting'){if(!this.near(r,frame.hero))return false;r.status='carried';this.log('倒れた村人を抱えた。船の救護所へ運ぼう。');}
    else if(this.near({x:-5,z:3},frame.hero)){r.status='safe';s.rescued++;s.experiences.care+=2;this.log('村人を救護所へ送り届けた。');}
    else{r.status='waiting';r.x=frame.hero.x;r.z=frame.hero.z;this.log('村人を安全な場所に降ろした。');}return true;
  }
  tick(realSeconds,frame){const s=this.state,effects=[];if(!finite(realSeconds,0,3600)||s.phase==='ended')return effects;s.lastWorld=frame.life.worldSeconds;
    if(frame.life.expired){this.end(frame.life);return ['ended'];}
    if(s.phase==='birth'){if(frame.life.ageYears>=4){this.release();effects.push('released');}return effects;}
    if(frame.hero.dead){s.activity=null;s.resting=false;s.downedSeconds+=realSeconds;const wait=s.zone==='village'?12:40;
      if(s.downedSeconds>=wait){s.downedSeconds=0;s.zone='village';s.rescue=null;s.returnAt=frame.life.worldSeconds+60;this.log('救助され、診療所で意識を取り戻した。');effects.push('recover');}return effects;
    }s.downedSeconds=0;
    if(s.activity){const p=this.places.find(p=>p.id===s.activity.place);if(p&&!this.near(p,frame.hero)){s.activity=null;this.log('移動したので、生活行動を中断した。');}
      else if((s.activity.remaining-=realSeconds)<=0){const k=s.activity.kind;s.experiences[k]++;s.activity=null;this.log(`${EXPERIENCES[k]}の経験を得た。`);}}
    if(s.resting){effects.push(this.near(this.places.find(p=>p.id==='clinic'),frame.hero)?'heal-clinic':'heal');}
    for(const d of DISCOVERIES)if(!s.discoveries.includes(d.id)&&Object.entries(d.needs).every(([k,n])=>s.experiences[k]>=n)){s.discoveries.push(d.id);s.pendingDiscoveries.push(d.id);this.log(`${d.name}。技目録で受け取れる。`);}
    if(s.zone==='frontier'&&!s.cleared&&frame.enemies.length>0&&frame.enemies.every(e=>e.dead)){s.cleared=true;s.victories++;this.log(s.front===5?'将を退けた。村へ帰る船が待っている。':`第${s.front+1}前線を突破した。`);}
    // Residents share the world clock, but are not invented biological parents.
    s.residents=s.residents.filter(r=>frame.life.worldSeconds-r.bornAt<5400);
    const cohort=Math.floor(frame.life.worldSeconds/300),id=`arrival-${cohort}`;
    if(s.residents.length<30&&!s.residents.some(r=>r.id===id))s.residents.push({id,name:names[cohort%names.length],bornAt:cohort*300});
    return effects;
  }
  end(life){const s=this.state;if(s.phase==='ended')return false;s.phase='ended';s.activity=null;s.resting=false;s.lastWorld=life.worldSeconds;
    s.history.unshift({generation:s.generation,worldEnd:life.worldSeconds,rescued:s.rescued,victories:s.victories,memento:'村で過ごした日々'});s.history.length=Math.min(100,s.history.length);this.log('90歳で生涯を終えた。技と装備設定は次の人生にも残る。');return true;}
  memento(name){if(this.state.phase!=='ended')return false;this.state.history[0].memento=String(name).slice(0,160);return true;}
  rebirth(life){if(this.state.phase!=='ended')return false;const old=this.state;this.state={...newborn(old.generation+1,life.worldSeconds),history:copy(old.history),residents:copy(old.residents)};return true;}
}
function saneAgeWait(life){return Math.max(0,15-life.ageYears)*60;}
