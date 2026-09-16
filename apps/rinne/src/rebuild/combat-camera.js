const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.z||0)-(b?.z||0));

export function rinneCombatCameraFrame({player,enemies=[],targetId=null,active=false}={}){
  if(!active||!player)return null;
  const living=(Array.isArray(enemies)?enemies:[]).filter(enemy=>enemy&&!enemy.dead&&Number.isFinite(enemy.x)&&Number.isFinite(enemy.z));
  const nearby=living.filter(enemy=>enemy.id===targetId||distance(player,enemy)<=6.8);
  if(!nearby.length)return null;
  const points=[player,...nearby],center=points.reduce((sum,point)=>({x:sum.x+point.x,z:sum.z+point.z}),{x:0,z:0});
  center.x/=points.length;center.z/=points.length;
  const spread=Math.max(...points.map(point=>distance(center,point)),0),multiple=nearby.length>1;
  const offset={
    x:clamp((multiple?8.8:7.8)+spread*.72,7.8,12.8),
    y:clamp((multiple?8.2:7.2)+spread*.92,7.2,13.6),
    z:clamp((multiple?11.9:10.5)+spread*.92,10.5,17.5),
  };
  return{look:{x:center.x,y:1.08,z:center.z},offset,count:nearby.length,spread};
}
