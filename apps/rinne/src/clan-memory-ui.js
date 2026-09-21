import { clanPresentation, clanFamilyLine } from './rebuild/clan-origin.js';
import { familyMemory } from './soul-origin-art.js';

/** Add family memory without replacing the existing life/technique journal. */
export function installClanMemoryUI(ui){
  const doc=ui.root.ownerDocument,win=doc.defaultView;
  const original={bindState:ui.bindState.bind(ui),summary:ui.summary.bind(ui),dispose:ui.dispose.bind(ui)};
  const caption=doc.createElement('small');caption.className='clan-caption';caption.hidden=true;ui.root.querySelector('.player-identity')?.append(caption);
  const training=doc.createElement('small');training.className='clan-training-memory';training.hidden=true;ui.training?.append(training);
  let state=null,key='',clan=null,disposed=false;
  function render(){
    if(disposed||!clan||ui.panel.hidden||ui.panel.dataset.type!=='record')return;
    const existing=ui.body.querySelector('.clan-memory');if(existing?.dataset.clanKey===key)return;
    existing?.remove();const card=doc.createElement('section');card.className='clan-memory';card.dataset.clanKey=key;card.setAttribute('aria-label','一族の起源と家伝');
    card.innerHTML=`${familyMemory(clan.culture)}<div><h3></h3><p data-clan-art></p><p data-clan-motto></p></div><p class="clan-inherited"></p>`;
    card.querySelector('h3').textContent=clan.family;card.querySelector('[data-clan-art]').textContent=`${clan.cultureLabel} · ${clan.label}`;card.querySelector('[data-clan-motto]').textContent=`「${clan.motto}」`;
    const ancestors=state.lineage||[],traditions=ancestors.filter(row=>(row.skills||[]).some(id=>!String(id).startsWith('basic.'))).length;
    card.querySelector('.clan-inherited').textContent=traditions?`${traditions}代が遺した技の記録。家伝も、あなたの歩みも、系譜に残る。`:`${clan.practice}。この家の最初の記憶。`;
    ui.body.prepend(card);
  }
  const observer=new win.MutationObserver(render);observer.observe(ui.body,{childList:true});observer.observe(ui.panel,{attributes:true,attributeFilter:['hidden','data-type']});
  ui.bindState=next=>{
    const result=original.bindState(next);state=next;
    const nextKey=`${next?.id||''}:${JSON.stringify(next?.clanOrigin||null)}:${next?.lineage?.length||0}`;
    if(nextKey!==key){key=nextKey;clan=clanPresentation(next?.clanOrigin);caption.hidden=!clan;caption.textContent=clan?`${clan.family} · ${clan.label}`:'';if(!clan)ui.body.querySelector('.clan-memory')?.remove();render();}
    return result;
  };
  ui.summary=(next,options)=>{
    const result=original.summary(next,options);
    const active=Boolean(clan&&(options?.training||next?.activity?.kind==='train'));
    training.hidden=!active;if(active){const line=clanFamilyLine(next,'train');if(training.textContent!==line)training.textContent=line;}
    return result;
  };
  ui.dispose=()=>{disposed=true;observer.disconnect();caption.remove();training.remove();original.dispose();};
  return ui;
}
