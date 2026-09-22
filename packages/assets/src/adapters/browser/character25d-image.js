import {cropSpriteReference,importSpriteAsset,loadSpriteImage,spriteAssetBlob} from './sprite25d-assets.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

function median(values){
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.floor(sorted.length*.5)]??255;
}

function backgroundColor(data,width,height){
  const samples=[],step=Math.max(1,Math.floor(Math.min(width,height)/48)),edge=Math.max(2,Math.floor(Math.min(width,height)*.035));
  for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step){
    if(x>edge&&x<width-edge&&y>edge&&y<height-edge)continue;
    const index=(y*width+x)*4;
    if(data[index+3]<180)continue;
    samples.push([data[index],data[index+1],data[index+2]]);
  }
  if(!samples.length)return [255,255,255];
  return [0,1,2].map(channel=>median(samples.map(sample=>sample[channel])));
}

function foregroundMask(data,width,height,bg){
  const mask=new Uint8Array(width*height),transparentBorder=[0,width-1,(height-1)*width,height*width-1].some(index=>data[index*4+3]<80);
  for(let i=0;i<mask.length;i++){
    const offset=i*4,alpha=data[offset+3];
    if(alpha<18)continue;
    if(transparentBorder){mask[i]=1;continue;}
    const pixel=[data[offset],data[offset+1],data[offset+2]],light=(pixel[0]+pixel[1]+pixel[2])/3;
    if(distance(pixel,bg)>42||(light<165&&distance(pixel,bg)>25))mask[i]=1;
  }
  // One cheap dilation pass connects outline fragments without turning the whole sheet into one blob.
  const dilated=mask.slice();
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
    const i=y*width+x;if(mask[i])continue;
    if(mask[i-1]||mask[i+1]||mask[i-width]||mask[i+width])dilated[i]=1;
  }
  return dilated;
}

function components(mask,width,height){
  const seen=new Uint8Array(mask.length),queue=new Uint32Array(mask.length),result=[];
  for(let start=0;start<mask.length;start++){
    if(!mask[start]||seen[start])continue;
    let head=0,tail=0,count=0,minX=width,maxX=0,minY=height,maxY=0;queue[tail++]=start;seen[start]=1;
    while(head<tail){
      const index=queue[head++],x=index%width,y=Math.floor(index/width);count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
        if(!ox&&!oy)continue;const nx=x+ox,ny=y+oy;if(nx<0||ny<0||nx>=width||ny>=height)continue;
        const next=ny*width+nx;if(mask[next]&&!seen[next]){seen[next]=1;queue[tail++]=next;}
      }
    }
    const w=maxX-minX+1,h=maxY-minY+1,area=w*h,density=count/area;
    if(h<height*.17||w<width*.025||w/h>1.25||count<width*height*.0018)continue;
    const touches=Number(minX===0)+Number(maxX===width-1)+Number(minY===0)+Number(maxY===height-1);
    const score=(h/height)*4+(count/(width*height))*8+density*.7-touches*.35;
    result.push({x:minX,y:minY,width:w,height:h,count,density,score});
  }
  return result.sort((a,b)=>b.score-a.score).slice(0,12);
}

function overlap(a,b){
  const x=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));
  const y=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  const intersection=x*y;
  return intersection/(a.width*a.height+b.width*b.height-intersection||1);
}

function chooseThree(candidates,width,height){
  let best=null;
  const list=candidates.filter(item=>item.width/item.height<.7).slice(0,9);
  for(let a=0;a<list.length;a++)for(let b=a+1;b<list.length;b++)for(let c=b+1;c<list.length;c++){
    const trio=[list[a],list[b],list[c]].sort((p,q)=>p.x-q.x),heights=trio.map(item=>item.height),bottoms=trio.map(item=>item.y+item.height);
    const ratio=Math.min(...heights)/Math.max(...heights),bottomSpread=(Math.max(...bottoms)-Math.min(...bottoms))/height;
    if(ratio<.62||bottomSpread>.19||trio.some((item,index)=>index&&overlap(item,trio[index-1])>.18))continue;
    const span=(trio[2].x+trio[2].width-trio[0].x)/width;
    if(span<.2)continue;
    const symmetry=Math.min(trio[0].width,trio[2].width)/Math.max(trio[0].width,trio[2].width);
    const gapA=trio[1].x-trio[0].x,gapB=trio[2].x-trio[1].x,gapBalance=Math.abs(gapA-gapB)/Math.max(gapA,gapB);
    if(symmetry<.62||gapBalance>.68)continue;
    const narrowSide=trio[1].width<Math.min(trio[0].width,trio[2].width)*.9?1:0;
    const score=trio.reduce((sum,item)=>sum+item.score,0)+ratio*2-bottomSpread*5+symmetry*3-gapBalance*2+narrowSide*2;
    if(!best||score>best.score)best={score,trio};
  }
  if(best)return best.trio;
  return null;
}

function toSourceRect(item,scaleX,scaleY,sourceWidth,sourceHeight,pad=.035){
  const extraX=item.width*pad,extraY=item.height*pad;
  const x=clamp(Math.floor((item.x-extraX)*scaleX),0,sourceWidth-1),y=clamp(Math.floor((item.y-extraY)*scaleY),0,sourceHeight-1);
  const right=clamp(Math.ceil((item.x+item.width+extraX)*scaleX),x+1,sourceWidth),bottom=clamp(Math.ceil((item.y+item.height+extraY)*scaleY),y+1,sourceHeight);
  return [x,y,right-x,bottom-y];
}

function removeBackground(imageData,bg){
  const {data,width,height}=imageData,seen=new Uint8Array(width*height),queue=new Uint32Array(width*height);let head=0,tail=0,removed=0;
  const matches=index=>{
    const offset=index*4;if(data[offset+3]<24)return true;
    return distance([data[offset],data[offset+1],data[offset+2]],bg)<58;
  };
  const visit=index=>{if(seen[index])return;seen[index]=1;if(matches(index))queue[tail++]=index;};
  for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x);}for(let y=0;y<height;y++){visit(y*width);visit(y*width+width-1);}
  while(head<tail){const index=queue[head++],x=index%width;const offset=index*4;if(data[offset+3])removed++;data[offset+3]=0;if(x)visit(index-1);if(x<width-1)visit(index+1);if(index>=width)visit(index-width);if(index<width*(height-1))visit(index+width);}
  // Keep the dominant remaining island. This strips labels and decorative marks after edge removal.
  const alpha=new Uint8Array(width*height);for(let i=0;i<alpha.length;i++)if(data[i*4+3]>16)alpha[i]=1;
  const islands=components(alpha,width,height).sort((a,b)=>b.count-a.count),keep=islands[0];
  if(keep){
    const margin=Math.max(2,Math.floor(Math.min(width,height)*.025));
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const inside=x>=keep.x-margin&&x<=keep.x+keep.width-1+margin&&y>=keep.y-margin&&y<=keep.y+keep.height-1+margin;
      if(!inside)data[(y*width+x)*4+3]=0;
    }
  }
  for(let x=0;x<width;x++){data[x*4+3]=0;data[((height-1)*width+x)*4+3]=0;}for(let y=0;y<height;y++){data[(y*width)*4+3]=0;data[(y*width+width-1)*4+3]=0;}
  return removed/(width*height);
}

// Drop detached sheet captions after edge matting. Source bytes stay intact.
function retainBodyComponent(image){
  const {data,width,height}=image,labels=new Int32Array(width*height),queue=new Uint32Array(width*height),sizes=[0];let label=0,best=0;
  for(let start=0;start<labels.length;start++){
    if(labels[start]||data[start*4+3]<32)continue;
    label++;let head=0,tail=1;queue[0]=start;labels[start]=label;
    while(head<tail){const i=queue[head++],x=i%width,y=Math.floor(i/width);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const j=ny*width+nx;if(!labels[j]&&data[j*4+3]>=32){labels[j]=label;queue[tail++]=j;}}}
    sizes[label]=tail;if(tail>sizes[best])best=label;
  }
  if(!best)return;
  for(let i=0;i<labels.length;i++)if(labels[i]!==best)data[i*4+3]=0;
}

async function transparentCrop(source,rect,bg){
  const image=await loadSpriteImage(spriteAssetBlob(source)),canvas=document.createElement('canvas');canvas.width=rect[2];canvas.height=rect[3];
  try{
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,...rect,0,0,rect[2],rect[3]);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),removedRatio=removeBackground(pixels,bg);retainBodyComponent(pixels);ctx.putImageData(pixels,0,0);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('透過素材を作成できません')),'image/png'));
    const file=new File([blob],'character-auto-pose.png',{type:'image/png'}),asset=await importSpriteAsset(file,{kind:'reference-crop',parentSha256:source.sha256,rect:[...rect],removeBorderWhite:false,backgroundMode:'auto-edge'});
    return {asset,removedRatio};
  }finally{canvas.width=canvas.height=1;}
}

export function detectCharacterSheetRegions(data,width,height){
  const bg=backgroundColor(data,width,height),found=components(foregroundMask(data,width,height,bg),width,height);
  return {bg,found,trio:chooseThree(found,width,height)};
}

export async function autoPrepareCharacterSheet(file){
  const source=await importSpriteAsset(file),image=await loadSpriteImage(spriteAssetBlob(source));
  const maxEdge=420,scale=Math.min(1,maxEdge/Math.max(source.width,source.height)),width=Math.max(1,Math.round(source.width*scale)),height=Math.max(1,Math.round(source.height*scale));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  try{
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,width,height);const pixels=ctx.getImageData(0,0,width,height),bg=backgroundColor(pixels.data,width,height);
    const found=components(foregroundMask(pixels.data,width,height,bg),width,height),trio=chooseThree(found,width,height),primary=trio?.[0]||found[0]||{x:0,y:0,width,height};
    const scaleX=source.width/width,scaleY=source.height/height,viewRects=trio?trio.map(item=>toSourceRect(item,scaleX,scaleY,source.width,source.height)):[toSourceRect(primary,scaleX,scaleY,source.width,source.height)];
    const assets={[source.sha256]:source},references={sheet:source.sha256,front:null,quarter:null,side:null,back:null};
    const names=['front','side','back'];
    for(let index=0;index<viewRects.length;index++){
      const {asset:viewAsset}=await transparentCrop(source,viewRects[index],bg);assets[viewAsset.sha256]=viewAsset;references[names[index]]=viewAsset.sha256;
    }
    const poseResult={asset:assets[references.front],removedRatio:0};
    return {assets,references,pose:poseResult.asset.sha256,diagnostics:{views:trio?3:1,removedRatio:poseResult.removedRatio,confidence:trio?'candidate':'single-view'}};
  }finally{canvas.width=canvas.height=1;}
}
