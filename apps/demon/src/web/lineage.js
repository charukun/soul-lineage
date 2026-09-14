import {PREY,FORMS} from '@soul/raid/world';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>{
  const d=new Date(value||0);
  return Number.isNaN(d.getTime())?'時刻不明':new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
};
const moveNames={ember:'猟りの詰め',dancer:'旅歩の返し',calm:'静かな間合い',stone:'受け止める足',shadow:'影渡りの足'};

function moveLabel(key){return moveNames[key]||key;}
function uniqueMoves(profile){return [...new Set(Object.values(profile.adaptations||{}).flatMap(a=>a.moves||[]))];}
function chips(items,kind){
  if(!items.length)return '<span class="lineage-empty">まだない</span>';
  return `<div class="lineage-chips">${items.map(key=>{
    const data=kind==='power'?PREY[key]:null;
    return `<span>${data?`${esc(data.glyph)} ${esc(data.power)}`:esc(moveLabel(key))}</span>`;
  }).join('')}</div>`;
}
function persistentPowers(keys){
  if(!keys.length)return '<p class="muted">まだ特能を喰らっていない。人を捕食すると、その性質が次の身体にも残る。</p>';
  return keys.map(key=>{
    const prey=PREY[key];
    if(!prey)return '';
    return `<div class="adaptation-row"><b>${esc(prey.glyph)} ${esc(prey.power)}</b><span>常時反映</span><small>${esc(prey.desc)}</small></div>`;
  }).join('');
}
function persistentMoves(moves){
  if(!moves.length)return '<p class="muted">まだ動きを覚えていない。戦うほど相手の動きが自動戦闘の候補へ加わる。</p>';
  return moves.map(move=>`<div class="adaptation-row"><b>${esc(moveLabel(move))}</b><span>自動戦闘</span><small>戦闘中の序・破・急を選ぶとき、この身体が使える動きの候補になる。</small></div>`).join('');
}
function lifeCard(entry,current=false){
  const powers=current?entry.powers||[]:entry.knownPowers||entry.powers||[];
  const moves=current?entry.moves||[]:entry.knownMoves||entry.moves||[];
  const powerTitle=current?'この生で新しく喰らった特能':'死亡時に残っていた特能';
  const moveTitle=current?'この生で新しく覚えた動き':'死亡時に残っていた動き';
  return `<article class="life-card ${current?'current-life':''}">
    <header><span>${current?'今の身体':'第'+entry.number+'生'}</span><b>${current?`第${entry.number}生 · 生存中`:'ここで死亡'}</b></header>
    <div class="life-metrics"><span>狩り <b>${entry.hunts||0}</b></span><span>捕食 <b>${entry.eaten||0}</b></span><span>交戦 <b>${entry.battles||0}</b></span></div>
    <small>${fmt(entry.bornAt)}${current?' から':' 〜 '+fmt(entry.endedAt)}</small>
    ${!current&&entry.form&&FORMS[entry.form]?`<p>${esc(FORMS[entry.form].name)}の身体で倒れた。</p>`:''}
    <h3>${powerTitle}</h3>${chips(powers,'power')}
    <h3>${moveTitle}</h3>${chips(moves,'move')}
  </article>`;
}

export function renderLineage(profile){
  const current=profile.currentLife||{number:(profile.lives?.length||0)+1,bornAt:Date.now(),hunts:0,eaten:0,battles:0,powers:[],moves:[]};
  const history=(profile.lives||[]).slice().reverse();
  const learned=Object.entries(profile.adaptations||{}).sort((a,b)=>(b[1].encounters||0)-(a[1].encounters||0));
  const moves=uniqueMoves(profile),visits=Object.values(profile.visits||{}).slice().reverse().slice(0,8);
  return `<div class="lineage-summary">
      <span>今 第${current.number}生</span><span>残る特能 ${profile.unlocked?.length||0}</span><span>残る動き ${moves.length}</span>
    </div>
    <p class="lineage-lead"><b>ここにある特能と動きは、死んでも消えない。</b><br>次の身体へ引き継がれ、自動戦闘で勝手に使われる。</p>
    <section class="adaptation-ledger"><h3>次の戦いにも残る特能</h3>${persistentPowers(profile.unlocked||[])}</section>
    <section class="adaptation-ledger"><h3>次の戦いにも残る動き</h3>${persistentMoves(moves)}</section>
    ${lifeCard(current,true)}
    <section class="adaptation-ledger"><h3>誰と戦って、何を覚えたか</h3>${learned.length?learned.map(([role,a])=>{
      const prey=PREY[role];
      return `<div class="adaptation-row"><b>${esc(prey?.name||role)}</b><span>${a.encounters}回 交戦</span><small>${(a.moves||[]).length?`${(a.moves||[]).map(m=>esc(moveLabel(m))).join(' · ')} を記憶`:'まだ動きは定着していない'}</small></div>`;
    }).join(''):'<p class="muted">まだ誰とも十分に戦っていない。</p>'}</section>
    <section class="scar-ledger"><h3>最近入った村</h3>${visits.length?visits.map(v=>`<div class="scar-row"><span>${esc(v.name)}</span><small>${esc(({entered:'今いる夜',escaped:'離脱した',defeated:'ここで死亡',abandoned:'途中で途絶',completed:'喰い抜けた'})[v.status]||v.status)}</small></div>`).join(''):'<p class="muted">まだ村に喰痕を残していない。</p>'}</section>
    ${history.length?`<section class="past-lives"><h3>過去の身体</h3>${history.map(l=>lifeCard(l,false)).join('')}</section>`:''}`;
}
