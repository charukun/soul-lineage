import {describeVillage,PREY} from '@soul/raid/world';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function card(v,profile,imported=false){
 const d=describeVillage(v),prey=PREY[v.target],visited=!!profile.visits?.[v.id];
 const identity=imported?'data-imported="1"':`data-village="${escape(v.id)}"`;
 const weather=v.weather==='rain'?'雨の夜':'深い霧';
 return `<button class="route-card raid-route ${visited?'scarred':''}" ${identity} ${imported&&visited?'disabled':''}>
 <span class="tag">${visited?'喰痕 · 閉':imported?'読み込んだ村 · オフライン':weather}</span>
 <span class="raid-heading"><strong>${d.label}</strong><span class="raid-danger" data-danger="${d.danger}">危険度 <b>${d.dangerLabel}</b></span></span>
 <span class="raid-counts"><span>家屋 <b>${d.homes}</b>棟</span><span>住人 <b>${d.residents}</b>人</span><span>武装者 <b>${d.armed}</b>人</span></span>
 <span class="raid-reason">${d.reason}</span>
 <span class="route-bottom"><span>${escape(prey.name)}の特能</span><span class="reward">${escape(prey.power)} · ${profile.unlocked.includes(v.target)?'刻印済み':'未刻'}</span></span>
 ${imported?`<span class="raid-note">${visited?'喰痕だけが残っている':'読み込んだ配置を使用。住人と危険度は単独狩り用の生成値。'}</span>`:''}
 </button>`;
}
export function renderRaidRoutes(offers,profile){
 return '<p class="raid-intro">灯りの密度と獲物の気配で、今夜の村を選ぶ。<br>喰痕の残る場所は、もう闇を開かない。</p>'+
 offers.map(v=>card(v,profile)).join('')+(profile.imported?card(profile.imported,profile,true):'')+
 '<p class="muted">危険度は住人数と最も強い獲物から滲む気配。警戒が満ちれば討伐騎士が来る。</p>';
}
