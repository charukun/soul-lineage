import {ORIGIN_QUESTIONS,chooseOriginAnswer,createLineageOrigin,describeLineage,normalizeFamilyPractice} from './rebuild/lineage-origin.js';
import {lineageSceneSvg,lineageCrestSvg} from './lineage-origin-art.js';

export function createLineageOriginUI({document,motionAllowed=()=>true,onTouch=()=>{}}){
  let active=null;
  function choose({hasSave=false}={}){
    if(active)return active.promise;
    let resolveChoice;
    const promise=new Promise(resolve=>{resolveChoice=resolve;});
    const dialog=document.createElement('dialog');dialog.className='lineage-origin';dialog.setAttribute('aria-labelledby','origin-question');
    const reduced=!motionAllowed()||Boolean(document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    dialog.dataset.motion=reduced?'off':'on';
    dialog.innerHTML='<div class="origin-water" aria-hidden="true"><i class="origin-rays"></i><i class="origin-current"></i><i class="origin-soul"></i><div class="origin-bubbles">'+Array.from({length:12},(_,i)=>`<i style="--i:${i}"></i>`).join('')+'</div><div class="origin-ripples"></div></div><header class="origin-nav"><button type="button" data-origin-back aria-label="ひとつ前の記憶へ">戻る</button><span>生まれる前の記憶</span><button type="button" data-origin-cancel>やめる</button></header><section class="origin-content"><div class="origin-progress" aria-label="問答の進み具合"></div><h2 id="origin-question" tabindex="-1" aria-live="polite"></h2><div class="origin-stage"></div></section><p class="origin-whisper" aria-hidden="true">水の記憶に、ふれる。</p>';
    const stage=dialog.querySelector('.origin-stage'),heading=dialog.querySelector('h2'),back=dialog.querySelector('[data-origin-back]'),progress=dialog.querySelector('.origin-progress'),timers=new Set();
    let step=hasSave?-1:0,answers={},busy=false;
    function later(fn,delay){const id=setTimeout(()=>{timers.delete(id);fn();},delay);timers.add(id);}
    function finish(value){
      if(active?.dialog!==dialog)return;
      active=null;for(const timer of timers)clearTimeout(timer);timers.clear();
      if(dialog.open)dialog.close();dialog.remove();document.body.classList.remove('rinne-origin-active');resolveChoice(value);
    }
    function render(){
      busy=false;delete dialog.dataset.changing;
      const question=ORIGIN_QUESTIONS[step];dialog.dataset.originStage=step<0?'replace':question?.key||'confirm';
      back.hidden=step<=0;progress.hidden=step<0;progress.setAttribute('aria-label',step<3?`問答 ${Math.max(1,step+1)} / 3`:'一族の確定');
      progress.innerHTML=ORIGIN_QUESTIONS.map((q,i)=>`<i data-complete="${i<step}" data-current="${i===step}"></i>`).join('');
      if(step<0){
        heading.textContent='別の一族を、はじめる？';
        stage.innerHTML='<div class="origin-replace"><p>今の一族と人生の保存は、新しい一族に入れ替わります。</p><p>最後に「この家に、生まれる」を選ぶまでは、何も変わりません。</p><button type="button" data-origin-replace>新しい記憶へ</button><button type="button" data-origin-keep>今の一族を残す</button></div>';
        stage.querySelector('[data-origin-replace]').addEventListener('click',()=>{step=0;render();});stage.querySelector('[data-origin-keep]').addEventListener('click',()=>finish(null));
      }else if(question){
        heading.textContent=question.title;
        stage.innerHTML='<div class="origin-memories">'+question.choices.map((choice,i)=>`<button type="button" class="origin-memory" data-origin-answer="${choice.id}" style="--order:${i}" aria-label="${choice.label}" aria-pressed="${answers[question.key]===choice.id}"><span class="origin-memory-art">${lineageSceneSvg(choice.scene)}</span><strong>${choice.label}</strong><small>${choice.detail}</small></button>`).join('')+'</div>';
        for(const button of stage.querySelectorAll('[data-origin-answer]'))button.addEventListener('click',()=>{
          if(busy)return;busy=true;onTouch();answers=chooseOriginAnswer(answers,step,button.dataset.originAnswer);
          button.dataset.chosen='true';dialog.dataset.changing='true';for(const item of stage.querySelectorAll('button'))item.disabled=true;
          later(()=>{step++;render();},reduced?0:240);
        });
      }else{
        const family=describeLineage(createLineageOrigin(answers));heading.textContent=family.houseName;
        stage.innerHTML=`<div class="origin-family" data-culture="${family.culture}"><div class="origin-family-scene">${lineageSceneSvg(family.culture,{family:true})}<span class="origin-family-crest">${lineageCrestSvg(family.ethos)}</span></div><p class="origin-family-roots">${family.cultureLabel} · ${family.ethosLabel}</p><p class="origin-family-art">お家芸 <strong>${family.artLabel}</strong></p><p class="origin-family-motto">${family.motto}</p><button type="button" data-origin-confirm>この家に、生まれる</button></div>`;
        stage.querySelector('[data-origin-confirm]').addEventListener('click',()=>{
          if(busy)return;busy=true;onTouch();dialog.dataset.surfacing='true';stage.querySelector('button').disabled=true;back.disabled=true;
          later(()=>finish(createLineageOrigin(answers)),reduced?0:680);
        });
      }
      heading.focus({preventScroll:true});
    }
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
    dialog.addEventListener('close',()=>finish(null));
    dialog.addEventListener('keydown',event=>event.stopPropagation());
    back.addEventListener('click',()=>{if(busy)return;step=Math.max(0,step-1);render();});
    dialog.querySelector('[data-origin-cancel]').addEventListener('click',()=>finish(null));
    dialog.addEventListener('pointermove',event=>{
      if(reduced)return;const box=dialog.getBoundingClientRect();
      dialog.style.setProperty('--soul-x',`${(event.clientX-box.left-box.width/2)*.07}px`);dialog.style.setProperty('--soul-y',`${(event.clientY-box.top-box.height*.33)*.05}px`);
    },{passive:true});
    dialog.addEventListener('pointerdown',event=>{
      if(reduced)return;const box=dialog.getBoundingClientRect(),layer=dialog.querySelector('.origin-ripples'),ripple=document.createElement('i');
      ripple.style.left=`${event.clientX-box.left}px`;ripple.style.top=`${event.clientY-box.top}px`;while(layer.childElementCount>=4)layer.firstElementChild.remove();layer.append(ripple);later(()=>ripple.remove(),1000);
    },{passive:true});
    active={dialog,promise,finish};document.body.classList.add('rinne-origin-active');document.body.append(dialog);
    try{dialog.showModal();render();}catch(error){finish(null);throw error;}
    return promise;
  }
  return {choose,dispose(){active?.finish(null);}};
}

export function refreshLineageTitle(title,saved){
  let family=null;try{family=describeLineage(saved?.lineageOrigin);}catch{}
  let scene=title.querySelector('.lineage-title-scene'),name=title.querySelector('.title-lineage-name');
  if(!family){delete title.dataset.lineage;scene?.remove();name?.remove();return null;}
  title.dataset.lineage=family.culture;
  if(!scene){scene=title.ownerDocument.createElement('div');scene.className='lineage-title-scene';scene.setAttribute('aria-hidden','true');title.prepend(scene);}
  const key=`${family.culture}:${family.ethos}`;if(scene.dataset.key!==key){scene.dataset.key=key;scene.innerHTML=lineageSceneSvg(family.culture,{family:true});}
  if(!name){name=title.ownerDocument.createElement('p');name.className='title-lineage-name';title.querySelector('.title-copy')?.after(name);}
  name.textContent=`${family.houseName} · お家芸 ${family.artLabel} · ${Math.max(1,Number(saved.generation)||1)}代目`;
  return family;
}

export function createLineageLifePanel({document,gameScreen,getState}){
  const button=document.createElement('button');button.type='button';button.className='lineage-family-command';button.hidden=true;button.setAttribute('aria-label','一族の家伝を開く');
  gameScreen.querySelector('.life-chip')?.append(button);
  const dialog=document.createElement('dialog');dialog.className='lineage-family-dialog';dialog.setAttribute('aria-labelledby','family-record-title');document.body.append(dialog);
  let lastKey='';
  function render(){
    const state=getState(),family=describeLineage(state?.lineageOrigin);if(!family)return;
    const practice=normalizeFamilyPractice(state.familyPractice);
    dialog.innerHTML=`<button type="button" class="family-close" aria-label="家伝を閉じる">×</button><header>${lineageCrestSvg(family.ethos)}<h2 id="family-record-title">${family.houseName}</h2><p>${family.cultureLabel} · ${family.ethosLabel}</p></header><div class="family-record-scene">${lineageSceneSvg(family.culture,{family:true})}</div><p class="family-motto">${family.motto}</p><dl><div><dt>お家芸</dt><dd>${family.artLabel}</dd></div><div><dt>家宝</dt><dd>${family.heirloom}</dd></div><div><dt>家伝</dt><dd>${family.practice}</dd></div></dl><p class="family-practice">稽古見学 ${practice.observations}回 · 家伝の稽古 ${practice.practices}回</p><p class="family-teaching">${family.teachingLine}</p><p class="family-freedom">この家で育ち、あなたの得物を選ぶ。</p><section class="family-ancestors"><h3>受け継いだ日々</h3></section>`;
    dialog.querySelector('.family-close').addEventListener('click',()=>dialog.close());
    const ancestors=dialog.querySelector('.family-ancestors'),records=Array.isArray(state.lineage)?state.lineage.slice(-4):[];
    if(!records.length){const text=document.createElement('p');text.textContent='あなたの一生が、この家の最初の物語になる。';ancestors.append(text);}
    for(const record of records){const text=document.createElement('p');text.textContent=`${record.generation}代目 ${record.name} · ${record.age}歳 · 技 ${record.skills?.length||0} · 凱旋 ${record.returnedHome?'あり':'なし'}`;ancestors.append(text);}
  }
  function sync(){
    const state=getState(),family=describeLineage(state?.lineageOrigin);button.hidden=!family;
    if(!family){delete gameScreen.dataset.lineageCulture;delete gameScreen.dataset.lineageArt;return;}
    const key=`${family.founderId}:${family.ethos}:${state.generation}`;
    if(lastKey!==key){lastKey=key;button.innerHTML=lineageCrestSvg(family.ethos);button.title=family.houseName;button.setAttribute('aria-label',`${family.houseName}の家伝を開く`);}
    gameScreen.dataset.lineageCulture=family.culture;gameScreen.dataset.lineageArt=family.art;
  }
  button.addEventListener('click',()=>{render();if(!dialog.open)dialog.showModal();});
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  return {sync,dispose(){if(dialog.open)dialog.close();dialog.remove();button.remove();delete gameScreen.dataset.lineageCulture;delete gameScreen.dataset.lineageArt;}};
}
