// Deterministic humanoid template, in metres with feet at y=0, facing +Z.
export const RIG_VERSION = 'humanoid-influence/v1';
export const LAYER_NAMES = Object.freeze(['hairBack','body','legs','arms','face','hairFront','clothing','accessories']);
export const clamp = (n,lo,hi)=>Math.max(lo,Math.min(hi,n));
export const angleDelta = (a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export function createHumanoidRig({head=.78,shoulder=.68,hip=.43,width=.24}={}) {
  head=clamp(head,.72,.84); shoulder=clamp(shoulder,.61,.72); hip=clamp(hip,.36,.49); width=clamp(width,.18,.32);
  const bones=[];
  const add=(name,parent,x,y,z=0)=>bones.push({name,parent,rest:[x,y,z]});
  add('root',null,0,0); add('pelvis','root',0,hip); add('spine','pelvis',0,(hip+shoulder)*.5);
  add('chest','spine',0,shoulder); add('neck','chest',0,head-.045); add('head','neck',0,head);
  for(const [side,sign] of [['L',1],['R',-1]]) {
    add('upperArm.'+side,'chest',sign*width*.57,shoulder-.015);
    add('lowerArm.'+side,'upperArm.'+side,sign*width*.73,(shoulder+hip)*.52);
    add('hand.'+side,'lowerArm.'+side,sign*width*.8,hip-.055);
    add('upperLeg.'+side,'pelvis',sign*width*.3,hip-.015);
    add('lowerLeg.'+side,'upperLeg.'+side,sign*width*.34,hip*.51);
    add('foot.'+side,'lowerLeg.'+side,sign*width*.36,.025,.035);
  }
  return {version:RIG_VERSION,bones,proportions:{head,shoulder,hip,width}};
}

// Analysis uses alpha, not invented body/face pixels. Cloth/occluded limbs remain
// uncertain template regions and are deliberately constrained at runtime.
export function analyzeSilhouette(data,width,height) {
  let left=width,top=height,right=-1,bottom=-1,count=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>32) {
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;
  }
  if(count<32||bottom-top<8)throw new Error('全身の輪郭を検出できません。背景と人物が分かれた画像を選んでください');
  const bounds=[left,top,right+1,bottom+1],h=bottom+1-top;
  const rowSpan=f=>{const y=clamp(Math.round(top+h*f),top,bottom);let a=width,b=-1;for(let x=left;x<=right;x++)if(data[(y*width+x)*4+3]>32){a=Math.min(a,x);b=x;}return b>=a?(b-a+1)/h:0;};
  return {bounds,coverage:count/(width*height),proportions:{head:.79,shoulder:.68,hip:.43,width:clamp(rowSpan(.4)*.65,.18,.32)},method:'alpha-bounds+humanoid-template',confidence:'template'};
}

export function layerAt(x,y,rig) {
  const {head,shoulder,hip,width}=rig.proportions,ax=Math.abs(x);
  if(y>head-.01)return ax>width*.5||y>.94?'hairFront':'face';
  if(y>shoulder&&ax>width*.52)return 'hairBack';
  if(ax>width*.91&&y>hip-.09&&y<shoulder-.08)return 'accessories';
  if(y>hip-.08&&y<shoulder&&ax>width*.5)return 'arms';
  if(y<hip*.65)return 'legs';
  if(y<hip+.075)return 'clothing';
  return 'body';
}

export function influenceAt(x,y,rig) {
  const {head,shoulder,hip,width}=rig.proportions;
  const side=x>=0?'L':'R',ax=Math.abs(x),weights=[];
  const add=(name,w)=>{if(w>0)weights.push([rig.bones.findIndex(b=>b.name===name),w]);};
  const blend=(a,b,t)=>{t=clamp(t,0,1);add(a,1-t);add(b,t);};
  if(y>=head-.055) add('head',1);
  else if(y>shoulder) blend('chest','head',(y-shoulder)/(head-.055-shoulder));
  else if(y>hip-.075&&ax>width*.5) {
    const elbow=(shoulder+hip)*.52;
    if(y>elbow)blend('lowerArm.'+side,'upperArm.'+side,(y-elbow)/(shoulder-elbow));
    else blend('hand.'+side,'lowerArm.'+side,(y-(hip-.055))/(elbow-(hip-.055)));
  } else if(y<hip) {
    if(y<.08) add('foot.'+side,1);
    else if(y<hip*.51)blend('foot.'+side,'lowerLeg.'+side,(y-.08)/(hip*.51-.08));
    else blend('lowerLeg.'+side,'upperLeg.'+side,(y-hip*.51)/(hip*.49));
    // Preserve joins at the hips and the centre of a skirt.
    const pelvis=clamp((y-hip*.78)/(hip*.22),0,1);
    for(const entry of weights)entry[1]*=1-pelvis;
    add('pelvis',pelvis);
  } else blend('pelvis','chest',(y-hip)/(shoulder-hip));
  return weights;
}

// Several low-density triangle meshes share a bind skeleton and original UVs.
// Duplicate boundary vertices receive identical weights: no detached square crops.
export function buildInfluenceMeshes(rig,{aspect=1,bounds=[0,0,1,1],width=1,height=1,side=false}={}) {
  const [left,top,right,bottom]=bounds,h=bottom-top,w=right-left,cols=20,rows=36;
  const scale=w/h,groups=Object.fromEntries(LAYER_NAMES.map(name=>[name,{name,positions:[],uvs:[],indices:[],skinIndices:[],skinWeights:[],secondary:[]} ]));
  const point=(col,row)=>({x:(col/cols-.5)*scale,y:1-row/rows,u:(left+w*col/cols)/width,v:1-(top+h*row/rows)/height});
  const vertex=(g,p)=>{
    const normalizedX=side?p.x*1.5:p.x,weights=influenceAt(normalizedX,p.y,rig);
    g.positions.push(p.x,p.y,0);g.uvs.push(p.u,p.v);
    for(let j=0;j<4;j++){g.skinIndices.push(weights[j]?.[0]??0);g.skinWeights.push(weights[j]?.[1]??0);}
    const lag=g.name==='hairBack'||g.name==='hairFront'?clamp((.95-p.y)/.25,0,1):g.name==='clothing'?clamp((rig.proportions.hip+.06-p.y)/.18,0,1):g.name==='accessories'?clamp((.62-p.y)/.2,0,1):0;
    g.secondary.push(lag);
  };
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++) {
    const a=point(col,row),b=point(col+1,row),c=point(col,row+1),d=point(col+1,row+1);
    for(const tri of [[a,c,b],[b,c,d]]) {
      const x=tri.reduce((n,p)=>n+p.x,0)/3,y=tri.reduce((n,p)=>n+p.y,0)/3;
      const g=groups[layerAt(side?x*1.5:x,y,rig)],index=g.positions.length/3;
      for(const p of tri)vertex(g,p);g.indices.push(index,index+1,index+2);
    }
  }
  return Object.values(groups).filter(g=>g.indices.length);
}
