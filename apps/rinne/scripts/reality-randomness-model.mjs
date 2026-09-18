import {createHash,createHmac,generateKeyPairSync,sign,verify} from 'node:crypto';
export const sha=(...p)=>{const h=createHash('sha256');for(const x of p)h.update(typeof x==='string'?x:JSON.stringify(x));return h.digest('hex')};
export const u32=(...p)=>parseInt(sha(...p).slice(0,8),16)>>>0;
export const outcome=(seed,ctx='rinne',b=16)=>u32('outcome-v1|',String(seed),'|',ctx)%b;
export function grind(values,fn,fav=x=>x===0){const rows=[...values].map(value=>({value,result:fn(value)})),chosen=rows.find(x=>fav(x.result))||rows[0]||null;return{rows,chosen,favorableFound:!!chosen&&fav(chosen.result)}}
export const bestOfK=(p,k)=>1-(1-p)**k;
export function selectiveAbort(desired=1){const rows=[0,1].map(h=>({honest:h,result:h,reveal:h===desired,p:.5})),done=rows.filter(x=>x.reveal),q=done.reduce((s,x)=>s+x.p,0);return{completion:q,conditional:Object.fromEntries([0,1].map(v=>[v,done.filter(x=>x.result===v).reduce((s,x)=>s+x.p/q,0)]))}}
export const vrfLike=(key,input,b=16)=>parseInt(createHmac('sha256',String(key)).update(`vrf-like-v1|${input}`).digest('hex').slice(0,8),16)%b;
export const beacon=round=>sha(`public-beacon-toy-v1|${round}`);
export const beaconOutcome=(actionId,round,b=16,domain='rinne:protected-random')=>u32(domain,'|',actionId,'|',String(round),'|',beacon(round))%b;
export function moduloCounts(n,b){const c=Array(b).fill(0);for(let i=0;i<n;i++)c[i%b]++;return c}
export function rejectionCounts(n,b){const lim=Math.floor(n/b)*b,c=Array(b).fill(0);for(let i=0;i<lim;i++)c[i%b]++;return{counts:c,rejected:n-lim}}
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const canonical=v=>JSON.stringify(stable(v));
export const rawSemanticDraw=text=>u32('raw|',String(text));
export const canonicalSemanticDraw=v=>u32('canonical|',canonical(v));
export const domainDraw=(root,label)=>u32('draw-v1|',label,'|',root);
export function createAuthority(){return generateKeyPairSync('ed25519')}
const msg=r=>Buffer.from(JSON.stringify({round:r.round,value:r.value}));
export const signRecord=(privateKey,round,value=beacon(round))=>({round,value,signature:sign(null,msg({round,value}),privateKey).toString('base64')});
export const verifyRecord=(record,publicKey)=>verify(null,msg(record),publicKey,Buffer.from(record.signature,'base64'));
export function contractIssues(c){const z=[];if(!c||typeof c!=='object')return['missing-contract'];if(c.fairnessSensitive!==true)return z;const need=(ok,name)=>{if(!ok)z.push(name)};need(c.sourceType,'source-type');need(c.sourceIdentityRoot,'source-identity');need(c.actionId,'action');need(c.bindActionBeforeReveal===true,'bind-action');need(c.bindInputBeforeReveal===true,'bind-input');need(c.bindSourceKeyBeforeReveal===true,'bind-key');if(c.sourceType==='public-beacon')need(c.bindRoundBeforeReveal===true,'bind-round');need(Number.isInteger(c.maxEquivalentAttempts)&&c.maxEquivalentAttempts>=1,'attempt-budget');need(['fail-closed','precommitted-fallback','explicit-abort-outcome'].includes(c.abortPolicy),'abort-policy');need(c.derivationDomain,'domain');need(c.distributionRoot,'distribution');need(c.bindDistributionBeforeReveal===true,'bind-distribution');need(Array.isArray(c.unpredictableTo)&&c.unpredictableTo.length,'unpredictable-to');need(c.commitmentPoint,'commitment-point');need(c.canonicalSemanticInput===true,'canonical-input');need(c.randomnessFailureMode,'failure-mode');if(c.multiParty){need(c.admissionRoot,'admission');need(c.bindAdmissionBeforeReveal===true,'bind-admission');need(c.principalModel,'principal');need(c.orderPolicy,'order')}return z}
export const adaptiveThreshold=(r,desired)=>({threshold:desired?Math.min(1,r+Number.EPSILON*Math.max(1,r)):r,result:r<(desired?Math.min(1,r+Number.EPSILON*Math.max(1,r)):r)});
export function fallback({available,actionId,round,seeds,b=16}){if(available)return{mode:'beacon',result:beaconOutcome(actionId,round,b)};const g=grind(seeds,s=>outcome(s,`fallback:${actionId}`,b));return{mode:'host-fallback',result:g.chosen?.result,seed:g.chosen?.value}}
export function majorityCycle(){const orders=[['A','B','C'],['B','C','A'],['C','A','B']],items=['A','B','C'],edges=[];for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){const a=items[i],b=items[j],ab=orders.filter(o=>o.indexOf(a)<o.indexOf(b)).length;if(ab>1)edges.push([a,b]);else edges.push([b,a])}const g=new Map(items.map(x=>[x,[]]));edges.forEach(([a,b])=>g.get(a).push(b));const seen=new Set(),path=new Set();function walk(n){if(path.has(n))return true;if(seen.has(n))return false;path.add(n);for(const x of g.get(n))if(walk(x))return true;path.delete(n);seen.add(n);return false}return{orders,edges,cyclic:items.some(walk)}}
export function rankedWinner(ids,round){const v=beacon(round),rows=ids.map(id=>({id,rank:sha('rank-v1|',String(round),'|',v,'|',id)})).sort((a,b)=>a.rank.localeCompare(b.rank)||a.id.localeCompare(b.id));return{winner:rows[0]?.id??null,rows}}
export function chooseAdmissionAfterReveal(ids,round,want){const other=ids.filter(x=>x!==want);for(let m=0;m<(1<<other.length);m++){const a=[want];for(let i=0;i<other.length;i++)if(m&(1<<i))a.push(other[i]);if(rankedWinner(a,round).winner===want)return a}return null}
export const sybilShare=(honest,adversary)=>adversary/(honest+adversary);
export function rinneHash01(v){let h=2166136261;for(const c of String(v)){h^=c.codePointAt(0);h=Math.imul(h,16777619)}return(h>>>0)/4294967295}
export function rinneSeedOf(t){let n=2166136261;for(const c of String(t))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0}
export const rinneFatal=(seed,hostile,sec,defeats=0)=>rinneHash01(`${seed}:${hostile}:fatal:${Math.floor(sec)}:${defeats}`);
export function grindRinneMs(start,count,hostile,sec,fav=x=>x>=.78){return grind(Array.from({length:count},(_,i)=>i),i=>rinneFatal((start+i)>>>0,hostile,sec),fav)}
export function grindWorldIds(ids,player,hostile,sec,fav=x=>x>=.78){return grind(ids,id=>rinneFatal(rinneSeedOf(`${id}:${player}`),hostile,sec),fav)}
export const witnessNames=Object.freeze(['seed-grinding','selective-abort','vrf-input-key-grinding','beacon-round-ticket-grinding','modulo-bias','domain-correlation','untrusted-source-key','adaptive-distribution','representation-grinding','admission-censorship','sybil-multiplicity','order-cycle','fallback-downgrade']);
