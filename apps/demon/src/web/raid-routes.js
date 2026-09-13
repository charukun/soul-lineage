import {describeVillage,PREY} from '@soul/raid/world';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function recommendRouteId(offers,profile){
 const candidates=(offers||[]).filter(v=>v&&!profile.visits?.[v.id]);
 if(!candidates.length)return null;
 const first=(Number(profile.hunts)||0)===0;
 return [...candidates].sort((a,b)=>{
  const da=describeVillage(a),db=describeVillage(b);
  if(!first){const au=profile.unlocked?.includes(a.target)?1:0,bu=profile.unlocked?.includes(b.target)?1:0;if(au!==bu)return au-bu;}
  return da.danger-db.danger||da.residents-db.residents||da.homes-db.homes||String(a.id).localeCompare(String(b.id));
 })[0].id;
}
function card(v,profile,imported=false,recommended=false){
 const d=describeVillage(v),prey=PREY[v.target],visited=!!profile.visits?.[v.id];
 const identity=imported?'data-imported="1"':`data-village="${escape(v.id)}"`;
 const weather=v.weather==='rain'?'雨の夜':'深い霧';
 const label=`${d.label}、危険度${d.dangerLabel}、住人${d.residents}人、${prey.power}${profile.unlocked.includes(v.target)?'習得済み':'未習得'}`;
 return `<button class="route-card raid-route${recommended?' recommended':''}" ${identity} ${imported&&visited?'disabled':''} aria-label="${escape(label)}">
 <span class="tag">${imported?'読み込んだ村 · オフライン':weather}${recommended?'<b class="raid-recommended">初回推奨</b>':''}</span>
 <span class="raid-heading"><strong>${d.label}</strong><span class="raid-danger" data-danger="${d.danger}">危険度 <b>${d.dangerLabel}</b></span></span>
 <span class="raid-counts"><span>家屋 <b>${d.homes}</b>棟</span><span>住人 <b>${d.residents}</b>人</span><span>武装者 <b>${d.armed}</b>人</span></span>
 <span class="raid-reason">${d.reason}</span>
 <span class="route-bottom"><span>${escape(prey.name)}の記憶</span><span class="reward">${escape(prey.power)} · ${profile.unlocked.includes(v.target)?'習得済み':'未習得'}</span></span>
 ${imported?`<span class="raid-note">${visited?'入村済み · 再訪不可':'読み込んだ配置を使用。住人と危険度は単独狩り用の生成値。'}</span>`:''}
 </button>`;
}
export function renderRaidRoutes(offers,profile){
 const recommended=recommendRouteId(offers,profile);
 return '<p class="raid-intro">村の規模と危険度で、今夜の襲撃先を選ぶ。<br>一度入った村は、撤退・敗北しても再訪できない。</p>'+
 offers.map(v=>card(v,profile,false,v.id===recommended)).join('')+(profile.imported?card(profile.imported,profile,true,false):'')+
 '<p class="muted">危険度は住人数と最も強い獲物を基にした目安。低危険度でも警戒が高まると討伐騎士が現れる。<br>生成村は単独プレイ用。実プレイヤーの村へは接続していない。</p>';
}
