/** Extend each chart's rasterized texels within its own cell before filtering.
 * Geometry and observed pixels are immutable. This supplies sampling support,
 * not new reference evidence; the original provenance mask stays unexpanded.
 */
export function chartGutterPlan(pixels,size,cells,triangles){
  if(pixels.length!==size*size*4||cells*cells<triangles)throw Error('Invalid atlas');
  const nearest=new Int32Array(size*size).fill(-1),queue=new Int32Array(size*size);
  let tail=0;
  for(let i=0;i<nearest.length;i++)if(pixels[i*4+3]){nearest[i]=i;queue[tail++]=i;}
  const rasterized=tail,owner=i=>Math.floor((Math.floor(i/size)+.5)*cells/size)*cells+Math.floor((i%size+.5)*cells/size);
  const seeded=new Set();for(let i=0;i<tail;i++)seeded.add(owner(queue[i]));
  for(let t=0;t<triangles;t++)if(!seeded.has(t))throw Error('No rasterized texels in UV chart '+t);
  for(let head=0;head<tail;head++){
    const i=queue[head],x=i%size,y=Math.floor(i/size),chart=owner(i);
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]){
      if(x+dx<0||x+dx>=size||y+dy<0||y+dy>=size)continue;
      const j=i+dy*size+dx;if(nearest[j]!==-1||owner(j)!==chart)continue;
      nearest[j]=nearest[i];queue[tail++]=j;
    }
  }
  return {nearest,rasterized,extended:tail-rasterized};
}
export function applyChartGutter(pixels,plan){
  for(let i=0;i<plan.nearest.length;i++){
    const source=plan.nearest[i];if(source<0)continue;
    if(!pixels[source*4+3])throw Error('Projection channels have different raster coverage');
    if(source!==i)pixels.set(pixels.subarray(source*4,source*4+3),i*4);
    pixels[i*4+3]=255;
  }
}
export function auditBilinearSupport(pixels,size,uv){
  let samples=0,missing=0;
  const sample=(u,v)=>{
    const x=u*size-.5,y=v*size-.5;
    for(const yy of [Math.floor(y),Math.ceil(y)])for(const xx of [Math.floor(x),Math.ceil(x)]){
      samples++;if(xx<0||yy<0||xx>=size||yy>=size||pixels[(yy*size+xx)*4+3]!==255)missing++;
    }
  };
  for(let t=0;t<uv.length;t+=6)for(let edge=0;edge<3;edge++){
    const a=t+edge*2,b=t+((edge+1)%3)*2;
    const steps=Math.ceil(Math.max(Math.abs(uv[a]-uv[b]),Math.abs(uv[a+1]-uv[b+1]))*size*2);
    for(let j=0;j<=steps;j++){const f=steps?j/steps:0;sample(uv[a]*(1-f)+uv[b]*f,uv[a+1]*(1-f)+uv[b+1]*f);}
  }
  if(missing)throw Error(`UV filtering has ${missing}/${samples} missing support texels`);
  return {samples,missing};
}
