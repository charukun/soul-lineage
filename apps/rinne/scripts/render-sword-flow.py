# Optional CPU rasterization of the actual skinned mesh and source textures.
# Requires numpy, Pillow and numba; this is not a WebGL/device performance test.
import json,struct,io,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from numba import njit
root=Path(sys.argv[1]);args=sys.argv[2:]
meta=json.loads((root/'capture.json').read_text());verts=np.memmap(root/'vertices.bin',dtype=np.float32,mode='r',shape=(meta['frameCount'],meta['count'],3))
b=(Path(__file__).parent/'../public/simulator/assets/SHINO_review.vrm').read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);bin=b[28+n:]
tex=[]
for m in meta['meshes']:
 row=g['materials'][m['material']] if m['material'] is not None else {};pbr=row.get('pbrMetallicRoughness',{});factor=pbr.get('baseColorFactor',m['color']+[1]);im=Image.new('RGBA',(256,256),(255,255,255,255))
 if 'baseColorTexture'in pbr:
  ti=pbr['baseColorTexture']['index'];ii=g['textures'][ti]['source'];view=g['bufferViews'][g['images'][ii]['bufferView']];raw=bin[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']];im=Image.open(io.BytesIO(raw)).convert('RGBA').resize((256,256))
 arr=np.array(im,dtype=np.float32);arr*=np.array(factor);tex.append(np.clip(arr,0,255).astype(np.uint8))
triangles=[];uvs=[];material=[]
for i,m in enumerate(meta['meshes']):
 ids=np.array(m['indices']).reshape(-1,3);triangles.extend(ids+m['start']);uv=np.array(m['uv']).reshape(-1,2) if m['uv'] else np.zeros((m['count'],2));uvs.extend(uv[ids]);material.extend([i]*len(ids))
triangles=np.array(triangles,dtype=np.int32);uvs=np.array(uvs,dtype=np.float32);material=np.array(material,dtype=np.int32);tex=np.array(tex)
@njit(cache=True)
def raster(screen,world,tris,uvs,mats,tex,img,zbuf):
 H,W=img.shape[:2]
 for k in range(len(tris)):
  ia,ib,ic=tris[k];a=screen[ia];b=screen[ib];c=screen[ic]
  den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
  if abs(den)<1e-6:continue
  x0=max(0,int(min(a[0],b[0],c[0])));x1=min(W-1,int(max(a[0],b[0],c[0]))+1);y0=max(0,int(min(a[1],b[1],c[1])));y1=min(H-1,int(max(a[1],b[1],c[1]))+1)
  v=world[ib]-world[ia];w=world[ic]-world[ia];nx=v[1]*w[2]-v[2]*w[1];ny=v[2]*w[0]-v[0]*w[2];nz=v[0]*w[1]-v[1]*w[0];length=(nx*nx+ny*ny+nz*nz)**.5
  lighting=.70+.28*abs((-nx*.3+ny*.6+nz*.7)/max(1e-9,length));mi=mats[k]
  for y in range(y0,y1+1):
   for x in range(x0,x1+1):
    wa=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den;wb=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;wc=1-wa-wb
    if wa<0 or wb<0 or wc<0:continue
    z=wa*a[2]+wb*b[2]+wc*c[2]
    if z>=zbuf[y,x]:continue
    u=wa*uvs[k,0,0]+wb*uvs[k,1,0]+wc*uvs[k,2,0];v=wa*uvs[k,0,1]+wb*uvs[k,1,1]+wc*uvs[k,2,1]
    px=tex[mi,min(255,max(0,int(v*255))),min(255,max(0,int(u*255)))]
    if px[3]<100:continue
    zbuf[y,x]=z
    for j in range(3):img[y,x,j]=min(255,int(px[j]*lighting))
 return img
view=args[0] if args else 'three';angle={'three':.65,'front':0,'side':1.57,'back':3.14}[view]
follow='--follow' in args
forward=np.array([-np.sin(angle),-.22,-np.cos(angle)]);forward/=np.linalg.norm(forward);right=np.cross(forward,[0,1,0]);right/=np.linalg.norm(right);up=np.cross(right,forward);basis=np.stack([right,-up,forward],axis=1)
requested=[int(a) for a in args[1:] if not a.startswith('--')]
defaults=[round(p*(meta['frameCount']-1)) for p in [0,.08,.14,.20,.26,.34,.43,.53,.64,.73,.86,1]]
frames=list(range(meta['frameCount'])) if '--all' in args else requested or defaults
frames=[i for i in frames if 0<=i<meta['frameCount']]
name=view+('-follow' if follow else '');out=root/name;out.mkdir(exist_ok=True)
target=np.array([0.,1.05,1.4]);scale=165.
if not follow:
 lo=np.min(verts,axis=(0,1));hi=np.max(verts,axis=(0,1));target=(lo+hi)/2
 corners=np.array([[x,y,z] for x in [lo[0],hi[0]] for y in [lo[1],hi[1]] for z in [lo[2],hi[2]]]);bounds=(corners-target)@basis
 scale=min(450/max(.01,np.ptp(bounds[:,0])),530/max(.01,np.ptp(bounds[:,1])))
for idx in frames:
 if follow:target=np.array([meta['points'][idx]['hips'][0],1.05,meta['points'][idx]['hips'][2]+.25])
 world=np.asarray(verts[idx]);screen=(world-target)@basis;screen[:,:2]*=scale;screen[:,0]+=256;screen[:,1]+=325
 im=np.zeros((620,512,3),dtype=np.uint8);im[:]=[39,53,61];grid=Image.fromarray(im);gd=ImageDraw.Draw(grid)
 for k in np.arange(-4,5,.5):
  for line in [[[k,.02,-3],[k,.02,5]],[[-4,.02,k],[4,.02,k]]]:
   pts=(np.array(line)-target)@basis;pts[:,:2]*=scale;pts[:,0]+=256;pts[:,1]+=325;gd.line([tuple(pts[0,:2]),tuple(pts[1,:2])],fill=(54,73,79),width=1)
 im=np.array(grid);z=np.full((620,512),np.inf);raster(screen,world,triangles,uvs,material,tex,im,z);img=Image.fromarray(im);d=ImageDraw.Draw(img);d.text((20,20),f'SHINO | {view} | {idx/(meta["frameCount"]-1)*meta.get("seconds",4):.2f} s',fill='#ead6ab');img.save(out/f'{idx:03}.png')
selected=frames if len(frames)<=15 else defaults
strip=Image.new('RGB',(512*3,620*((len(selected)+2)//3)),(20,30,35))
for i,idx in enumerate(selected):strip.paste(Image.open(out/f'{idx:03}.png'),((i%3)*512,(i//3)*620))
strip.save(root/f'{name}-strip.jpg',quality=88)
print(root/f'{name}-strip.jpg')
