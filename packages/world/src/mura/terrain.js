/** Shared terrain data: the renderer and placement predicates use exactly these sites. */
export const LIMIT=256,SIZE=512;
export const riverX=z=>78+Math.sin(z*.018)*16;
export const TERRAIN_SITES=[
 {kind:'forest',x:-43,z:-23,r:27,label:'木立'}, {kind:'forest',x:-37,z:57,r:25,label:'深い林'},
 {kind:'forest',x:-125,z:-80,r:55,label:'西の森'}, {kind:'forest',x:117,z:73,r:35,label:'川向こうの森'},
 {kind:'rock',x:29,z:-44,r:10,label:'露岩'}, {kind:'rock',x:-83,z:23,r:15,label:'石の尾根'},
 {kind:'rock',x:-161,z:-115,r:20,label:'岩の丘'},
 {kind:'wetland',x:-44,z:28,r:11,label:'湿った土'}, {kind:'wetland',x:61,z:20,r:13,label:'川辺の泥'},
 {kind:'fertile',x:-6,z:-45,r:30,label:'肥沃な草地'}, {kind:'fertile',x:23,z:39,r:30,label:'ひらけた草地'},
 {kind:'fertile',x:-115,z:100,r:46,label:'西の草原'}, {kind:'fertile',x:123,z:-76,r:45,label:'東の草原'}
];
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const nearSite=(kind,x,z,margin=0)=>TERRAIN_SITES.some(s=>s.kind===kind&&Math.hypot(s.x-x,s.z-z)<=s.r+margin);
export const inWater=(x,z,margin=0)=>x>180-margin||Math.abs(x-riverX(z))<7+margin&&![-42,54].some(b=>Math.abs(z-b)<5-margin);
const rand=n=>{const x=Math.sin(n*127.13+18.3)*41758.34;return x-Math.floor(x);};
export function naturalTrees(){const result=[];let i=0;
 for(const s of TERRAIN_SITES.filter(s=>s.kind==='forest'))for(let n=0;n<24;n++,i++){const a=rand(i+82)*6.28,r=Math.sqrt(rand(i+393))*s.r;result.push({x:s.x+Math.cos(a)*r,z:s.z+Math.sin(a)*r,s:1+rand(i+88)*.8,yaw:rand(i+501)*6.28,kind:i%4?'tree':'pine'});}
 for(let n=0;n<180;n++,i++){const x=(rand(i)-.5)*590,z=(rand(i+1001)-.5)*590;if(Math.hypot(x,z)<110||Math.abs(x-riverX(z))<14||x>172)continue;result.push({x,z,s:1+rand(i+88)*1.1,yaw:rand(i+501)*6.28,kind:i%4?'tree':'pine'});}return result;
}
const trees=naturalTrees();
export function terrainError(kind,x,z,objects=[]){
 if(!kind)return null;
 if(kind==='coast')return x>=163&&x<=170?null:'船着き場は東海岸の岸沿いに置きます';
 if(kind==='forest')return trees.some(t=>Math.hypot(t.x-x,t.z-z)<23)||objects.some(o=>['tree','pine'].includes(o.kind)&&Math.hypot(o.x-x,o.z-z)<23)?null:'林・植林から23m以内に置きます';
 if(kind==='rock')return nearSite('rock',x,z,18)?null:'露岩から18m以内に石切場を置きます';
 if(kind==='wetland')return nearSite('wetland',x,z,12)||Math.abs(x-riverX(z))<24?null:'湿った土か川岸から12m以内に置きます';
 if(kind==='fertile')return nearSite('fertile',x,z)?null:'色の明るい、肥沃な草地に置きます';
 if(kind==='water')return Math.abs(x-riverX(z))<33||nearSite('wetland',x,z,22)?null:'川や湿地のそばに水を引ける場所が必要です';
 return null;
}
export const terrainHint=kind=>({forest:'林のそば',rock:'露岩のそば',wetland:'湿地・川岸',fertile:'肥沃な草地',water:'川・湿地のそば',coast:'東海岸'}[kind]||'平らな陸地');
