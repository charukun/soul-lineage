"""Bridge actual Blender-edited topology back through existing Forge export,
validation and discovery. Actual source projection has per-texel attribution;
generated facial/material paint is never labelled observed reference content.
"""
from pathlib import Path
import sys,json,math,struct,hashlib,os
import numpy as np
from PIL import Image,ImageFilter
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from exporter import export_glb
from animation import create_animations,quat
from validation import validate_export,read_export
from registration import create_manifest,register_review
from normalization import SIZE,PAD,HEIGHT
PKG=ROOT/'packages/assets/characters/forge/golden-base-boy-v1';WORK=ROOT/'.dcc-work/golden-base-boy-v1'
D=json.loads((WORK/'dcc-meshes.json').read_text());N=D['atlasSize'];ROUND=D['round']
texdir=PKG/'build/textures';texdir.mkdir(parents=True,exist_ok=True)
source=Image.open(PKG/'source/original-user-sheet.jpg').convert('RGB');original=np.asarray(source,dtype=float)
provenance=json.loads((PKG/'source/provenance.json').read_text());crops={};masks={}
for v in ('front','side','back'):
    crops[v]=provenance['sourceViews'][v]['sheetRect'];masks[v]=np.asarray(Image.open(PKG/'source'/(v+'.png')).convert('RGBA'))[:,:,3]
atlas=np.zeros((N,N,3),np.uint8)+220;wa=np.zeros((N,N,4),np.uint8);wb=np.zeros((N,N,4),np.uint8);coverage=np.zeros((N,N),bool)
contributions={v:0. for v in ('front','front34','side','back34','back')};counts={'generated':0,'projected':0,'uvInteriorOverlap':0}
S=1.6/610;SC=source.width/1408
colors={'head':[245,216,212],'ear':[246,210,205],'ear-inner':[231,168,166],'eye-white':[251,252,255],'pupil':[8,24,39],'highlight':[255,255,255],'lash':[46,31,34],'lower-lid':[204,136,141],'brow':[89,126,127],'mouth':[94,32,44],'lip':[215,151,152]}

def paint(role,p,n,meta):
    # p/n are actual Blender vertices/normals in the runtime coordinate system:
    # p=(x,up,forward) metres. The authoritative images remain immutable.
    count=len(p);base=np.tile(np.array(colors.get(role,[245,216,212]),float),(count,1))
    if role=='body':
        gray=(p[:,1]>.488)&(p[:,1]<.948)&(np.abs(p[:,0])<np.where(p[:,1]>.85,.142,.194))
        base[gray]=[190,188,188]
    if role=='iris':
        cz=meta['eyeCenter'][1];cx=meta['eyeCenter'][0]
        q=np.clip((p[:,1]-(cz-.054))/.108,0,1)
        top=np.array([26,75,119]);bottom=np.array([45,203,229]);base=bottom[None,:]*(1-q[:,None])+top[None,:]*q[:,None]
        radius=((p[:,0]-cx)/.043)**2+((p[:,1]-cz)/.054)**2
        rim=np.clip((radius-.78)/.17,0,1);base=base*(1-.68*rim[:,None])
        angle=np.arctan2(p[:,1]-cz,p[:,0]-cx);striations=1+.045*np.sin(angle*31);base*=striations[:,None]
    if role=='head':
        blush=np.exp(-((np.abs(p[:,0])-.205)/.042)**2-((p[:,1]-1.097)/.027)**2)*np.clip(n[:,2],0,1)
        base=base*(1-.22*blush[:,None])+np.array([245,156,164])*.22*blush[:,None]
    weights=np.zeros((count,5),float);gen=np.ones(count,float)
    if role not in ('head','body','ear'):return np.clip(base,0,255),weights,gen,np.zeros(count,bool)
    # Modest reference contribution keeps lit reference pixels from becoming
    # invented albedo. Facial blue pixels are excluded beneath actual eye meshes.
    strength=np.full(count,.20 if role=='body' else .13)
    if role=='head':strength[(p[:,1]<1.325)&(n[:,2]>.2)]=0
    accum=np.zeros((count,3));tot=np.zeros(count)
    mirrored=np.zeros(count,bool)
    for name,i in [('front',0),('side',2),('back',4)]:
        if name=='front':col=216+p[:,0]/S;weight=np.clip(n[:,2],0,1)**3
        elif name=='back':col=860-p[:,0]/S;weight=np.clip(-n[:,2],0,1)**3
        else:col=539-p[:,2]/S;weight=np.abs(n[:,0])**3
        row=774-p[:,1]/S;xx=np.round(col*SC).astype(int);yy=np.round(row*SC).astype(int)
        x0,y0,x1,y1=crops[name];cx=xx-x0;cy=yy-y0
        ok=(cx>=0)&(cy>=0)&(cx<masks[name].shape[1])&(cy<masks[name].shape[0])&(xx>=0)&(xx<source.width)&(yy>=0)&(yy<source.height)
        indices=np.flatnonzero(ok);ok[indices]&=masks[name][cy[indices],cx[indices]]>128
        weight*=ok;weights[:,i]=weight;idx=np.flatnonzero(weight>0)
        accum[idx]+=original[yy[idx],xx[idx]]*weight[idx,None];tot+=weight
        if name=='side':mirrored|=(weight>0)&(n[:,0]<0)
    ok=tot>0;weights[ok]*=(strength[ok]/tot[ok])[:,None];weights[~ok]=0;gen=1-weights.sum(1)
    base[ok]=base[ok]*gen[ok,None]+accum[ok]/tot[ok,None]*strength[ok,None]
    return np.clip(base,0,255),weights,gen,mirrored

for part in D['parts']:
    p=np.array(part['positions'],float)*1.6;n=np.array(part['normals'],float);uv=np.array(part['uv'],float)*(N-1);idx=np.array(part['indices'],int).reshape(-1,3)
    for face in idx:
        t=uv[face];lo=np.maximum(0,np.floor(t.min(0)).astype(int));hi=np.minimum(N-1,np.ceil(t.max(0)).astype(int))
        if np.any(hi<lo):continue
        ax,ay=t[0];bx,by=t[1];cx,cy=t[2];den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
        if abs(den)<1e-8:continue
        yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];px=xx+.5;py=yy+.5
        a=((by-cy)*(px-cx)+(cx-bx)*(py-cy))/den;b=((cy-ay)*(px-cx)+(ax-cx)*(py-cy))/den;c=1-a-b
        inside=(a>=-1e-7)&(b>=-1e-7)&(c>=-1e-7)
        if not np.any(inside):continue
        x=xx[inside];y=yy[inside];bary=np.stack((a[inside],b[inside],c[inside]),1)
        positions=bary@p[face];normals=bary@n[face];normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-8)
        color,weight,generated,mirror=paint(part['role'],positions,normals,part)
        strict=(bary.min(1)>.004);counts['uvInteriorOverlap']+=int(np.sum(coverage[y,x]&strict));coverage[y,x]=True
        atlas[y,x]=np.round(color).astype(np.uint8);wa[y,x]=np.round(weight[:,:4]*255).astype(np.uint8)
        wb[y,x,0]=np.round(weight[:,4]*255).astype(np.uint8);wb[y,x,1]=mirror*255;wb[y,x,2]=np.round(generated*255).astype(np.uint8);wb[y,x,3]=255
        for i,name in enumerate(('front','front34','side','back34','back')):contributions[name]+=float(weight[:,i].sum())
        counts['generated']+=int(np.sum(generated>.999));counts['projected']+=int(np.sum(generated<.999))
# Nearest ring propagation pads UV islands without smearing their interiors.
for _ in range(5):
    old=coverage.copy();suma=np.zeros_like(atlas,dtype=np.uint32);suma_a=np.zeros_like(wa,dtype=np.uint32);suma_b=np.zeros_like(wb,dtype=np.uint32);num=np.zeros((N,N),np.uint8)
    for dy,dx in [(0,1),(0,-1),(1,0),(-1,0)]:
        valid=np.roll(old,(dy,dx),(0,1));valid[0 if dy==1 else -1 if dy==-1 else slice(0,0),:]=False
        if dx==1:valid[:,0]=False
        if dx==-1:valid[:,-1]=False
        add=valid&~old;num+=add;suma+=np.roll(atlas,(dy,dx),(0,1))*add[:,:,None];suma_a+=np.roll(wa,(dy,dx),(0,1))*add[:,:,None];suma_b+=np.roll(wb,(dy,dx),(0,1))*add[:,:,None]
    new=num>0;atlas[new]=(suma[new]/num[new,None]).astype(np.uint8);wa[new]=(suma_a[new]/num[new,None]).astype(np.uint8);wb[new]=(suma_b[new]/num[new,None]).astype(np.uint8);coverage|=new
Image.fromarray(atlas).save(texdir/'base-color.png');Image.fromarray(wa).save(texdir/'source-weights-a.png');Image.fromarray(wb).save(texdir/'source-weights-b.png')
texture_info={'dimensions':[N,N],'method':'barycentric UV bake of actual Blender-edited triangles; generated base paint plus bounded normal-weighted original-view samples','sampleContributions':contributions,'generatedTexels':counts['generated'],'projectedTexels':counts['projected'],'uvInteriorOverlapSamples':counts['uvInteriorOverlap'],'colorNormalization':'reference lighting not solved; contribution explicitly limited and recorded'}
# Combine disjoint source surfaces into one draw call. Skin and real morph deltas
# remain vertex data. Source .blend retains the editable quadrangulated meshes.
combined={'id':'GoldenBaseBoy','positions':[],'normals':[],'uv':[],'joints':[],'weights':[],'indices':[],'component':{'status':'inferred; Blender refined'},'morphTargets':{n:[] for n in D['morphNames']}}
for part in D['parts']:
    offset=len(combined['positions'])
    for k in ('positions','normals','uv','joints','weights'):combined[k]+=part[k]
    combined['indices'] += [i+offset for i in part['indices']]
    for name in D['morphNames']:combined['morphTargets'][name]+=part['morphTargets'][name]
if len(combined['positions'])>65535:raise ValueError('16-bit export vertex budget exceeded')
spec=json.loads((PKG/'spec/reconstruction.json').read_text());spec['levels'].update({'chin':.974/1.6,'shoulder':.90/1.6,'chest':.84/1.6,'waist':.72/1.6,'hip':.53/1.6,'knee':.295/1.6,'ankle':.088/1.6})
spec['rig']={'id':'rinne.forge.humanoid.v1','coordinateSystem':'+Y up, +Z forward','bindPose':'reference shallow A-pose','bones':D['bones'],'jointStatus':'inferred; Blender reference-fitted','skin':'linear-blend','goldenBaseProfile':'rinne.golden-base-boy.v1','externalGoldenRigVerified':False}
by_name={b['name']:b for b in D['bones']}
def socket(name,bone,target):
    q=by_name[bone]['position'];return name,{'bone':bone,'offset':[target[i]/1.6-q[i] for i in range(3)]}
entries=[socket('Head','head',[0,1.60,0]),socket('LeftHand','hand.L',[.467,.774,.011]),socket('RightHand','hand.R',[-.467,.774,.011]),socket('Weapon','hand.R',[-.467,.774,.011]),socket('head','head',[0,1.60,0]),socket('leftHand','hand.L',[.467,.774,.011]),socket('rightHand','hand.R',[-.467,.774,.011]),socket('weapon','hand.R',[-.467,.774,.011]),socket('secondaryGripTarget','hand.R',[-.467,.774,.011]),socket('weaponHitboxAnchor','hand.R',[-.467,.99,.011]),socket('trailOrigin','hand.R',[-.467,1.47,.011]),socket('heldItemAnchor','hand.L',[.467,.774,.011]),socket('talkAnchor','head',[0,1.69,0])]
spec['sockets']['definitions']=dict(entries);spec['sockets']['aliases'].update({'Head':'Head','LeftHand':'LeftHand','RightHand':'RightHand','Weapon':'Weapon'})
spec['dccRefinement']={'round':ROUND,'blenderVersion':D['blenderVersion'],'sourceTopology':'source/dcc/topology.json','headToBodyRatio':D['headToBodyRatio'],'headProfile':D['headProfile'],'authoringSource':'source/dcc/golden-base-boy-v1-authoring.blend','initialPipelineOutput':'source/dcc/pipeline-import.blend','actualMorphs':D['morphNames'],'unsupportedClaims':['No independently specified external Golden Rig was available; fitted Forge hierarchy is used','No facial/oral anatomical simulation or motion-capture polish claimed'],'shapeAuthority':'central source Front/Side/Back; printed 3.5 ratio and right technical thumbnails are not shape authority','clothingMeshes':0,'hairMeshes':0,'accessoryMeshes':0}
spec['textureProjection']=texture_info
clips=create_animations(D['bones']);times=[0,.3,.7,1.];tracks=[]
for i,b in enumerate(D['bones']):
    if any(b['name'].startswith(f) for f in ('thumb','index','middle','ring','little')):
        s=1 if b['name'].endswith('.L') else -1;tracks.append({'bone':i,'path':'rotation','times':times,'values':[quat([0,0,1],s*a) for a in (0,-.70,-.70,0)]})
clips.append({'name':'Grip','duration':1.,'loop':True,'tracks':tracks,'status':'generated'})
model=PKG/'build/character.glb';export_glb(spec,[combined],D['bones'],clips,texdir/'base-color.png',model)
# Add optional standard glTF morph accessors to the actual shared-exporter GLB.
# This narrowly scoped bridge does not alter the legacy pipeline or its gates.
raw=model.read_bytes();jslen=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+jslen]);binary=bytearray(raw[28+jslen:]);targets=[]
for name in D['morphNames']:
    values=np.asarray(combined['morphTargets'][name],dtype='<f4')*1.6
    while len(binary)%4:binary.append(0)
    offset=len(binary);payload=values.tobytes();binary+=payload
    doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(payload)})
    doc['accessors'].append({'bufferView':len(doc['bufferViews'])-1,'componentType':5126,'count':len(values),'type':'VEC3','min':values.min(0).tolist(),'max':values.max(0).tolist()})
    targets.append({'POSITION':len(doc['accessors'])-1})
meshdoc=doc['meshes'][0];meshdoc['primitives'][0]['targets']=targets;meshdoc['weights']=[0.]*len(targets);meshdoc['extras']={'targetNames':D['morphNames']}
doc['buffers'][0]['byteLength']=len(binary);doc['extras']['goldenBaseProfile']='rinne.golden-base-boy.v1';doc['extras']['blenderRefinementRound']=ROUND
js=json.dumps(doc,separators=(',',':'),allow_nan=False).encode();js+=b' '*((-len(js))%4);binary+=b'\0'*((-len(binary))%4)
model.write_bytes(struct.pack('<III',0x46546c67,2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary)
views={}
for name in ('front','side','back'):
    # Preserve all original pipeline reference measurements; use the existing
    # normalized references to diagnose the newly delivered mesh, not vice versa.
    ref=Image.open(PKG/'review/references'/(name+'.png')).convert('RGBA');views[name]={'mask':ref.getchannel('A')}
report=validate_export(spec,views,model,texture_info,PKG/'review/comparisons')
report['dccTopology']={'sourceClosed':True,'sourceQuadFraction':sum(x['quads'] for x in D['sourceTopology'])/sum(x['faces'] for x in D['sourceTopology']),'boneCount':len(D['bones']),'fingersPerHand':5,'uvInteriorOverlapSamples':counts['uvInteriorOverlap']}
report['morphs']={name:{'nonzeroVertices':sum(any(abs(v)>1e-8 for v in d) for d in combined['morphTargets'][name]),'maxDisplacementMetres':float(np.linalg.norm(np.array(combined['morphTargets'][name])*1.6,axis=1).max())} for name in D['morphNames']}
if any(v['nonzeroVertices']==0 for v in report['morphs'].values()):raise ValueError('Static placeholder morph detected')
report['goldenRig']={'runtimeContract':'rinne.forge.humanoid.v1','fittedProfile':'rinne.golden-base-boy.v1','externalContractVerified':False}
report['limitations']+=['Fitted Golden Base profile uses the existing Forge hierarchy; external Golden Rig equivalence is not asserted','Geometric ocular/expression surfaces are stylized, not full eyelid/oral anatomy','Generic candidate motion requires art review; no production promotion']
(PKG/'spec/reconstruction.json').write_text(json.dumps(spec,indent=2));(PKG/'validation-report.json').write_text(json.dumps(report,indent=2))
manifest=create_manifest(spec,report,clips,model);manifest['assetKind']='golden-base';manifest['goldenBaseProfile']='rinne.golden-base-boy.v1';manifest['morphTargets']=D['morphNames'];manifest['dccSource']='source/dcc/golden-base-boy-v1-authoring.blend'
(PKG/'manifest.json').write_text(json.dumps(manifest,indent=2));register_review(ROOT)
(PKG/'source/dcc/bake-receipt.json').write_text(json.dumps({'round':ROUND,'texture':texture_info,'modelSha256':report['modelSha256'],'sourceSha256':provenance['originalSha256'],'structuralStatus':report['structuralStatus'],'visualApproval':'pending','productionReady':False},indent=2))
if report['structuralStatus']!='passed':raise ValueError(report['errors'])
print(json.dumps({'stage':'BLENDER_REFINED_FORGE_PACKAGE','round':ROUND,'performance':report['performance'],'morphs':report['morphs'],'comparisons':report['comparisons']}))
