import {PREY,FORMS} from '@soul/raid/world';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>{
  const d=new Date(value||0);
  return Number.isNaN(d.getTime())?'時刻不明':new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
};
const moveNames={ember:'猟りの詰め',dancer:'旅歩の返し',calm:'静かな間合い',stone:'受け止める足',shadow:'影渡りの足'};

function chips(items,kind){
  if(!items.length)return '<span class="lineage-empty">まだ刻まれていない</span>';
  return `<div class="lineage-chips">${items.map(key=>{
    const data=kind==='power'?PREY[key]:null;
    return `<span>${data?`${esc(data.glyph)} ${esc(data.power)}`:esc(moveNames[key]||key)}</span>`;
  }).join('')}</div>`;
}

function lifeCard(entry,current=false){
  const powers=current?entry.powers||[]:entry.knownPowers||entry.powers||[];
  const moves=current?entry.moves||[]:entry.knownMoves||entry.moves||[];
  return `<article class="life-card ${current?'current-life':''}">
    <header><span>第${entry.number}生</span><b>${current?'生存中':'喰われた夜'}</b></header>
    <div class="life-metrics"><span>狩夜 <b>${entry.hunts||0}</b></span><span>捕食 <b>${entry.eaten||0}</b></span><span>交戦 <b>${entry.battles||0}</b></span></div>
    <small>${fmt(entry.bornAt)}${current?' から':' 〜 '+fmt(entry.endedAt)}</small>
    ${!current&&entry.form&&FORMS[entry.form]?`<p>${esc(FORMS[entry.form].name)}として倒れた。</p>`:''}
    <h3>喰らった特能</h3>${chips(powers,'power')}
    <h3>身体が写した動き</h3>${chips(moves,'move')}
  </article>`;
}

export function renderLineage(profile){
  const current=profile.currentLife||{number:(profile.lives?.length||0)+1,bornAt:Date.now(),hunts:0,eaten:0,battles:0,powers:[],moves:[]};
  const history=(profile.lives||[]).slice().reverse();
  const learned=Object.entries(profile.adaptations||{}).sort((a,b)=>(b[1].encounters||0)-(a[1].encounters||0));
  const visits=Object.values(profile.visits||{}).slice().reverse().slice(0,8);
  return `<div class="lineage-summary">
      <span>転生 ${current.number}</span><span>特能 ${profile.unlocked?.length||0}</span><span>写し ${new Set(learned.flatMap(([,a])=>a.moves||[])).size}</span>
    </div>
    <p class="lineage-lead">死ねば身体は生まれ直す。喰らった特能と、戦いで写した動きは次の生へ沈殿する。</p>
    ${lifeCard(current,true)}
    <section class="adaptation-ledger"><h3>戦いの癖</h3>${learned.length?learned.map(([role,a])=>{
      const prey=PREY[role];
      return `<div class="adaptation-row"><b>${esc(prey?.name||role)}</b><span>交戦 ${a.encounters}</span><small>${(a.moves||[]).map(m=>esc(moveNames[m]||m)).join(' · ')||'観察中'}</small></div>`;
    }).join(''):'<p class="muted">まだ誰の動きも身体に残っていない。</p>'}</section>
    <section class="scar-ledger"><h3>喰痕</h3>${visits.length?visits.map(v=>`<div class="scar-row"><span>${esc(v.name)}</span><small>${esc(({entered:'夜の中',escaped:'離脱',defeated:'ここで死亡',abandoned:'途絶',completed:'喰い抜け'})[v.status]||v.status)}</small></div>`).join(''):'<p class="muted">まだ地図に傷はない。</p>'}</section>
    ${history.length?`<section class="past-lives"><h3>死んだ生</h3>${history.map(l=>lifeCard(l,false)).join('')}</section>`:''}`;
}
