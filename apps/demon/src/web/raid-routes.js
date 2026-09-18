export function pickRandomRaid(offers,profile={},random=Math.random){
 const candidates=(offers||[]).filter(v=>v&&typeof v.id==='string'&&!profile.visits?.[v.id]);
 if(!candidates.length)return null;
 let roll=Number(random());
 if(!Number.isFinite(roll))roll=0;
 roll=Math.max(0,Math.min(.999999999999,roll));
 return candidates[Math.floor(roll*candidates.length)];
}
