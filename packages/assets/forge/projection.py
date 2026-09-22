import math
from PIL import Image
from common import ANGLES,VIEWS
from geometry import surface
from normalization import SIZE,PAD,HEIGHT

TILE=96
COLS=5

def project_textures(spec,views,meshes,out):
    height=math.ceil(len(meshes)/COLS)*TILE; width=COLS*TILE
    atlas=Image.new('RGB',(width,height),(135,135,135))
    weights_a=Image.new('RGBA',(width,height),(0,0,0,0));weights_b=Image.new('RGBA',(width,height),(0,0,0,0))
    # Linear blend in sRGB-decoded space; output is an sRGB baseColor texture.
    linear=[(v/255/12.92 if v/255<=.04045 else ((v/255+.055)/1.055)**2.4) for v in range(256)]
    encode=lambda v: round(255*(12.92*v if v<=.0031308 else 1.055*v**(1/2.4)-.055))
    lookup={v:s['normalized'].load() for v,s in views.items()}
    pixel=atlas.load(); wa=weights_a.load(); wb=weights_b.load(); totals={v:0 for v in VIEWS}; unknown=0; mirrored=0
    for index,mesh in enumerate(meshes):
        ox=(index%COLS)*TILE;oy=(index//COLS)*TILE
        for py in range(TILE):
            for px in range(TILE):
                # glTF UV y=0 is the top of the embedded texture. Geometry uv v=0 is sole.
                u=max(0,min(1,(px-2)/(TILE-5)));v=1-max(0,min(1,(py-2)/(TILE-5)))
                p,n=surface(mesh['component'],u,v); samples=[]
                mirror=n[0]<0
                nx=abs(n[0]); x=abs(p[0]) if mirror else p[0]
                for view in views:
                    angle=ANGLES[view]; weight=max(0,nx*math.sin(angle)+n[2]*math.cos(angle))**3
                    if weight<.0001: continue
                    # Front/back preserve their actual left-right pixels; only unseen opposite obliques mirror.
                    xx=p[0] if view in ('front','back') else x
                    col=round(SIZE/2+(xx*math.cos(angle)-p[2]*math.sin(angle))*HEIGHT)
                    row=round(SIZE-PAD-p[1]*HEIGHT)
                    if not (0<=col<SIZE and 0<=row<SIZE): continue
                    color=lookup[view][col,row]
                    if color[3]<96: continue
                    samples.append((view,weight,color))
                total=sum(s[1] for s in samples); weights=[0]*5
                if total:
                    color=[encode(sum(linear[s[2][c]]*s[1]/total for s in samples)) for c in range(3)]
                    for view,weight,_ in samples:
                        value=weight/total;weights[VIEWS.index(view)]=round(value*255);totals[view]+=value
                    if spec.get('assetRole')=='golden-base' and mesh['id']!='head':
                        color=[244,218,212]
                    pixel[ox+px,oy+py]=tuple(color)
                    if mirror: mirrored+=1
                else:
                    # An unseen surface gets a neutral generated texel, never front-as-back.
                    unknown+=1
                wa[ox+px,oy+py]=tuple(weights[:4]);wb[ox+px,oy+py]=(weights[4],255 if mirror else 0,255 if not total else 0,255)
        mesh['uv']=[[(ox+2+u*(TILE-5))/width,(oy+2+(1-v)*(TILE-5))/height] for u,v in mesh['uv']]
        spec['textureProjectionRegions'].append({'component':mesh['id'],'atlasRect':[ox,oy,TILE,TILE],'views':list(views),'method':'normal-weighted orthographic multi-view projection; 2px gutter','status':'interpolated'})
    out.mkdir(parents=True,exist_ok=True)
    atlas.save(out/'base-color.png');weights_a.save(out/'source-weights-a.png');weights_b.save(out/'source-weights-b.png')
    return {'dimensions':[width,height],'method':'CPU baked multi-view normal-weighted linear-color projection','weights':{'source-weights-a.png':['front','front34','side','back34'],'source-weights-b.png':['back','mirrored','generated','opaque']},'sampleContributions':totals,'unobservedTexels':unknown,'mirroredTexels':mirrored,'colorNormalization':'sRGB linearization only; reference lighting retained'}
