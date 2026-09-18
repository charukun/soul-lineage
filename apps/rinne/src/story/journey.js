import {DISCOVERIES,EXPERIENCES} from '../game/story.js';
import {mountPageLayout} from './page-layout.js';
const stages={jo:'序',ha:'破',kyu:'急'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function nextPractice(story,id){
 const d=story.learning().find(d=>d.id===id)||story.learning().find(d=>!d.learned);
 const step=d?.progress.find(p=>p.count<p.needed);if(!step)return null;
 const place=story.places.find(p=>p.activity===step.kind);
 return {discovery:d,kind:step.kind,place,action:`activity:${step.kind}:${place?.id||'field'}`};
}
/** Focused journal pages. Selection is local UI state; all commands recheck live game state. */
export function createJourney({win,port,ui,getStory,onAction,onSave}){
 const doc=win.document,dialog=doc.createElement('dialog');dialog.id='story-journey';dialog.className='story-sheet story-page-dialog';
 dialog.setAttribute('aria-labelledby','journey-title');
 dialog.innerHTML='<header class="sheet-heading"><div><small>輪廻転焦 · 旅の手帳</small><h2 id="journey-title">暮らしと支度</h2></div><button class="sheet-close" aria-label="暮らしと支度を閉じる">×</button></header><div class="book-flex-body"><section class="journey-section book-structure" id="journey-life"></section><section class="journey-section book-structure" id="journey-skills"></section><section class="journey-section book-structure" id="journey-trip"></section></div>';
 doc.body.append(dialog);const life=dialog.querySelector('#journey-life'),skills=dialog.querySelector('#journey-skills'),trip=dialog.querySelector('#journey-trip');
 const book=mountPageLayout(dialog.querySelector('.book-flex-body'),{chapters:()=>[{title:'生活',nodes:[...life.children]},{title:'覚えた技',nodes:[...skills.children]},{title:'遠征',nodes:[...trip.children]}],label:'暮らしと支度のページ'});
 const abort=new win.AbortController(),on=(el,type,fn)=>el.addEventListener(type,fn,{signal:abort.signal});
 let chosenDiscovery=DISCOVERIES[0].id,chosenSkill='',chosenSlot='jo:0',last='';
 function render(force=false){if(!dialog.open&&!force)return;const story=getStory(),s=story.state,f=port.snapshot(),learned=port.learnedSkills(),slots=port.skillSlots();
  const signature=JSON.stringify([s.experiences,s.pendingDiscoveries,s.discoveries,s.zone,s.returns,s.skillUses,!!s.activity,s.cleared,Math.floor(f.life.ageYears),Math.floor(f.life.worldSeconds/60),f.life.rate,Math.ceil(f.hero.hp),f.hero.dead,learned,ui.canPause(),chosenDiscovery,chosenSkill,chosenSlot]);if(!force&&signature===last)return;last=signature;
  const discoveries=story.learning(),d=discoveries.find(d=>d.id===chosenDiscovery),practice=nextPractice(story,chosenDiscovery),near=!practice?.place||story.near(practice.place,f.hero),canLive=s.phase==='living'&&s.zone==='village'&&!f.hero.dead;
  life.innerHTML=`<p class="journey-lead">暮らして覚え、支度をして旅に出る</p><label class="journey-control">目指す閃き<select id="journey-discovery">${discoveries.map(d=>`<option value="${d.id}" ${d.id===chosenDiscovery?'selected':''}>${d.learned?'習得済 · ':d.pending?'受取待ち · ':''}${d.name}</option>`).join('')}</select></label><p>${d.progress.map(p=>`${EXPERIENCES[p.kind]} ${Math.min(p.count,p.needed)} / ${p.needed}`).join('　')}<br><small>行動は1回8秒。歩き出すと中断します。</small></p><button id="journey-practice" ${!canLive||!!s.activity||!practice?'disabled':''}>${practice?near?`${EXPERIENCES[practice.kind]}を始める`:`${esc(practice.place.name)}へ向かう · ${EXPERIENCES[practice.kind]}`:'必要な経験を重ねました'}</button><button id="journey-receive" ${!canLive||!s.pendingDiscoveries.length?'disabled':''}>${s.pendingDiscoveries.length?`閃いた技を受け取る（${s.pendingDiscoveries.length}）`:'経験を重ねると技を閃きます'}</button>`;
  if(!learned.some(r=>r.id===chosenSkill))chosenSkill=learned.at(-1)?.id||'';const skill=learned.find(r=>r.id===chosenSkill);
  skills.innerHTML=`<p class="journey-lead">覚えた技を、次の戦いに</p>${skill?`<label class="journey-control">覚えた技<select id="journey-skill">${learned.map(r=>`<option value="${esc(r.id)}" ${r.id===chosenSkill?'selected':''}>${esc(r.name)} · 第${r.id.split('-')[1]}生</option>`).join('')}</select></label><p id="journey-equipped">${skill.slots.length?skill.slots.map(v=>`${stages[v.stage]} ${v.index+1}に装備 · 選択率${v.weight}%`).join(' / '):'まだ装備していません。装備先を選んでください。'}${s.skillUses.includes(skill.id)?'<br>前線で使用済み':''}</p><label class="journey-control">入れ替える枠<select id="journey-slot">${slots.map(v=>`<option value="${v.stage}:${v.index}" ${`${v.stage}:${v.index}`===chosenSlot?'selected':''}>${stages[v.stage]} ${v.index+1} · ${v.weight}% · ${esc(v.name)}</option>`).join('')}</select></label><button id="journey-assign" ${s.phase!=='living'||f.hero.dead||!ui.canPause()?'disabled':''}>選んだ枠へ装備する</button><p><small>選んだ枠の技を入れ替えます。0%の枠は戦闘で選ばれません。「技・装備」で比率を調整できます。</small></p>`:'<p>まず生活のページで経験を重ね、閃いた技を受け取りましょう。技は次の人生にも引き継がれます。</p>'}`;
  const equipped=learned.some(r=>r.slots.some(v=>v.weight>0)),ready=story.canDepart(f.life),portPlace=story.places.find(p=>p.id==='port');
  trip.innerHTML=`<p class="journey-lead">${s.zone==='frontier'?`第${s.front+1}前線${s.cleared?' · 突破':''}`:s.returns?'おかえりなさい。次の旅支度を。':'村から、はじめての遠征へ'}</p><p>${learned.length?'✓ 技を習得':'○ 生活で技を覚える'}　${equipped?'✓ 技を装備':'○ 技を装備する'}<br>体力 ${Math.ceil(f.hero.hp)} / ${f.hero.maxhp} · ${Math.floor(f.life.ageYears)}歳<br>${s.zone==='frontier'?'敵に近づくと自動で戦います。画面をスワイプで移動、タップで停止。':ready?'出航できます。船着き場へ向かいましょう。':`出航は15歳から、世界暦5年ごと。次は${story.nextDeparture(f.life)}年。帰還後は1年以上村で過ごします。`}</p><button id="journey-travel" ${s.phase!=='living'||f.hero.dead?'disabled':''}>${s.zone==='frontier'?(story.near({x:-5,z:3},f.hero)?'村へ帰る':'帰還船へ向かう'):story.near(portPlace,f.hero)&&ready?'船に乗る':'船着き場へ向かう'}</button><button id="journey-rest" ${!canLive?'disabled':''}>村で休み、体力を回復する</button><label class="journey-control">ひとりの旅 · 時の流れ<select id="journey-rate" ${!ui.canPause()?'disabled':''}>${Array.from({length:20},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===f.life.rate?'selected':''}>${n}倍 · 1年${60/n===Math.floor(60/n)?60/n:(60/n).toFixed(1)}秒</option>`).join('')}</select></label><p><small>年齢と世界時計だけが進みます。生活行動・移動・戦闘は同じ速さです。寿命は90歳。手帳を閉じると再開します。</small></p>`;
  book.refresh();
 }
 function open(chapter='生活'){render(true);ui.openDialog(dialog);book.refresh();win.requestAnimationFrame(()=>book.showNode((chapter==='覚えた技'?skills:chapter==='遠征'?trip:life).firstElementChild));}
 on(dialog.querySelector('.sheet-close'),'click',()=>dialog.close());on(dialog,'keydown',e=>e.stopPropagation());
 on(dialog,'change',e=>{if(!['journey-discovery','journey-skill','journey-slot','journey-rate'].includes(e.target.id))return;if(e.target.id==='journey-discovery')chosenDiscovery=e.target.value;if(e.target.id==='journey-skill')chosenSkill=e.target.value;if(e.target.id==='journey-slot')chosenSlot=e.target.value;if(e.target.id==='journey-rate'&&ui.canPause()){port.setRate(Number(e.target.value));onSave();}render(true);});
 on(dialog,'click',e=>{const id=e.target.closest('button')?.id,story=getStory(),s=story.state,f=port.snapshot();
  if(id==='journey-practice'){const p=nextPractice(story,chosenDiscovery);if(!p)return;if(p.place&&!story.near(p.place,f.hero))ui.selectTarget(p.place.id);else onAction(p.action);dialog.close();}
  if(id==='journey-receive'){onAction('discover');render(true);book.refresh();win.requestAnimationFrame(()=>book.showNode(skills.firstElementChild));}
  if(id==='journey-assign'&&s.phase==='living'&&ui.canPause()){const [stage,index]=chosenSlot.split(':');if(port.assignLearnedSkill(chosenSkill,stage,Number(index))){story.log(`「${port.learnedSkills().find(r=>r.id===chosenSkill).name}」を${stages[stage]} ${Number(index)+1}に装備した。`);onSave();}render(true);}
  if(id==='journey-travel'){if(s.zone==='frontier'&&story.near({x:-5,z:3},f.hero)||s.zone==='village'&&story.near(story.places.find(p=>p.id==='port'),f.hero)&&story.canDepart(f.life))onAction('travel');else ui.selectTarget(s.zone==='village'?'port':'return');dialog.close();}
  if(id==='journey-rest'){onAction('rest');dialog.close();}
 });
 return {open,render,practice:()=>nextPractice(getStory(),chosenDiscovery),destroy(){abort.abort();book.destroy();dialog.close();dialog.remove();}};
}
