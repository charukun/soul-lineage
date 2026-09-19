const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.z||0)-(b?.z||0));

export function combatCameraFrame({player,threats=[],style='rinne',wide=false}={}){
  if(!player)return null;
  const living=(Array.isArray(threats)?threats:[]).filter(row=>row&&!row.dead&&!row.eaten&&Number.isFinite(Number(row.x))&&Number.isFinite(Number(row.z)));
  if(!living.length)return null;
  const points=[player,...living],center=points.reduce((sum,point)=>({x:sum.x+Number(point.x||0),z:sum.z+Number(point.z||0)}),{x:0,z:0});
  center.x/=points.length;center.z/=points.length;
  const spread=Math.max(...points.map(point=>distance(center,point)),0);
  if(style==='demon'){
    const zoom=clamp((wide?11:13.6)+spread*1.2,wide?11.5:14,wide?18:22),height=clamp((wide?8.6:10.8)+spread*.85,wide?9:11,wide?15.5:18.5),angle=.33;
    return{style:'demon',camera:{x:center.x+Math.sin(angle)*zoom*.88,y:height,z:center.z+Math.cos(angle)*zoom*.88},look:{x:center.x,y:.75,z:center.z},count:living.length,spread};
  }
  const multiple=living.length>1;
  const offset={
    x:clamp((multiple?8.8:7.8)+spread*.72,7.8,12.8),
    y:clamp((multiple?8.2:7.2)+spread*.92,7.2,13.6),
    z:clamp((multiple?11.9:10.5)+spread*.92,10.5,17.5),
  };
  return{style:'rinne',look:{x:center.x,y:1.08,z:center.z},offset,count:living.length,spread};
}

export function combatCameraPosition(frame){
  if(!frame)return null;
  if(frame.camera)return{...frame.camera};
  if(frame.look&&frame.offset)return{x:frame.look.x+frame.offset.x,y:frame.look.y+frame.offset.y,z:frame.look.z+frame.offset.z};
  return null;
}
