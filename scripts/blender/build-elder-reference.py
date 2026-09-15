"""Author one original elder mesh from the repository concept sheet.
Blender 4.3+: --background --python this.py -- --root REPO [--no-render]
Mesh topology, UVs, weights and material grouping are retained in the .blend.
The borrowed humanoid names/metadata are from the audited Shino rig only.
"""
from pathlib import Path
import argparse, hashlib, json, math, struct, sys
import bpy, bmesh
from mathutils import Vector, Euler
from math import sin, cos, pi, exp

ap=argparse.ArgumentParser();ap.add_argument('--root',required=True);ap.add_argument('--no-render',action='store_true')
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);ROOT=Path(a.root)
OUT=ROOT/'assets/characters/elderly-man/dcc-v1';OUT.mkdir(parents=True,exist_ok=True)
QA=ROOT/'docs/characters/qa/elderly-man-dcc';QA.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'apps/rinne/public/simulator/assets';SOURCE=PUBLIC/'SHINO_review.vrm'
def read_glb(p):
 b=p.read_bytes();off=12;chunks=[]
 while off<len(b):
  n,t=struct.unpack_from('<II',b,off);chunks.append((t,b[off+8:off+8+n]));off+=8+n
 return json.loads(chunks[0][1]),chunks[1:]
src,_=read_glb(SOURCE)
NAMES={k:src['nodes'][v['node']]['name'] for k,v in src['extensions']['VRMC_vrm']['humanoid']['humanBones'].items()}
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.unit_settings.system='METRIC'
MATS={};objects=[]
def material(name,color,rough=.75,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
 bs.inputs['Specular IOR Level'].default_value=.28
 MATS[name]=m;return m
skin=material('Skin_warm_ivory',(.63,.395,.25),.76)
blush=material('Skin_rose_undertone',(.52,.235,.15),.82)
hair=material('Hair_warm_silver',(.52,.50,.43),.75)
hairlight=material('Hair_cream_highlights',(.68,.66,.57),.78)
eye=material('Face_warm_umber',(.07,.039,.023),.78)
linen=material('Cloth_unbleached_linen',(.53,.45,.31),.87)
seam=material('Cloth_linen_seams',(.34,.27,.17),.88)
olive=material('Cloth_moss_wool',(.155,.173,.10),.91)
oliveEdge=material('Cloth_wool_binding',(.235,.23,.13),.91)
scarf=material('Cloth_walnut_scarf',(.135,.083,.045),.9)
pants=material('Cloth_charcoal_breeches',(.065,.050,.033),.92)
socks=material('Cloth_oat_socks',(.31,.275,.18),.92)
leather=material('Leather_chestnut',(.095,.049,.024),.7)
edge=material('Leather_worn_edges',(.20,.115,.057),.81)
sole=material('Leather_dark_sole',(.037,.025,.016),.84)
brass=material('Metal_old_brass',(.36,.225,.075),.44,.65)

# Same semantic skeleton and source bone names; proportions fitted to this person.
rigdata=bpy.data.armatures.new('Elder_ShinoHumanoid');rig=bpy.data.objects.new('Elder_Rig',rigdata);scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
B={}
def bone(h,head,tail,parent=None):
 b=rigdata.edit_bones.new(NAMES[h]);b.head=head;b.tail=tail
 if parent:b.parent=B[parent]
 B[h]=b
bone('hips',(0,0,.86),(0,0,.97));bone('spine',(0,0,.97),(0,.012,1.15),'hips')
bone('chest',(0,.012,1.15),(0,.02,1.28),'spine');bone('upperChest',(0,.02,1.28),(0,0,1.37),'chest')
bone('neck',(0,0,1.37),(0,-.025,1.46),'upperChest');bone('head',(0,-.025,1.46),(0,-.035,1.78),'neck')
for side,s in [('left',1),('right',-1)]:
 bone(side+'Eye',(.08*s,-.17,1.67),(.08*s,-.21,1.67),'head')
 bone(side+'Shoulder',(.045*s,.012,1.32),(.225*s,0,1.32),'upperChest')
 bone(side+'UpperArm',(.225*s,0,1.32),(.47*s,0,1.32),side+'Shoulder')
 bone(side+'LowerArm',(.47*s,0,1.32),(.70*s,0,1.32),side+'UpperArm')
 bone(side+'Hand',(.70*s,0,1.32),(.79*s,0,1.32),side+'LowerArm')
 for f,dy,length in [('Index',-.047,.081),('Middle',-.015,.095),('Ring',.019,.087),('Little',.047,.065)]:
  x=.788;prev=side+'Hand'
  for j,seg in enumerate(['Proximal','Intermediate','Distal']):
   h=side+f+seg;nx=x+length*[.44,.33,.23][j]
   bone(h,(s*x,dy,1.32),(s*nx,dy,1.317-j*.004),prev);x=nx;prev=h
 prev=side+'Hand'
 for j,seg in enumerate(['Metacarpal','Proximal','Distal']):
  h=side+'Thumb'+seg;bone(h,(s*(.72+.028*j),-.025-.024*j,1.31),(s*(.748+.028*j),-.049-.024*j,1.306),prev);prev=h
 bone(side+'UpperLeg',(.105*s,0,.86),(.118*s,-.018,.48),'hips')
 bone(side+'LowerLeg',(.118*s,-.018,.48),(.12*s,0,.16),side+'UpperLeg')
 bone(side+'Foot',(.12*s,0,.16),(.12*s,-.16,.065),side+'LowerLeg')
 bone(side+'Toes',(.12*s,-.16,.065),(.12*s,-.225,.055),side+'Foot')
bpy.ops.object.mode_set(mode='OBJECT')

def choose(o):
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o

def torso_weights(v):
 z=v.z
 if z<.87:return {'hips':1}
 if z<1.08:
  t=(z-.87)/.21;return {'hips':1-t,'spine':t}
 if z<1.23:
  t=(z-1.08)/.15;return {'spine':1-t,'chest':t}
 return {'chest':.45,'upperChest':.55}
def arm_weights(v,s):
 side='left' if s>0 else 'right';x=abs(v.x)
 if x<.25:
  t=max(0,min(1,(x-.14)/.11));return {'upperChest':1-t,side+'UpperArm':t}
 if x<.42:return {side+'UpperArm':1}
 if x<.52:
  t=(x-.42)/.10;return {side+'UpperArm':1-t,side+'LowerArm':t}
 if x<.67:return {side+'LowerArm':1}
 t=min(1,(x-.67)/.055);return {side+'LowerArm':1-t,side+'Hand':t}
def leg_weights(v,s):
 side='left' if s>0 else 'right';z=v.z
 if z>.8:
  t=min(1,(z-.8)/.10);return {side+'UpperLeg':1-t,'hips':t}
 if z>.54:return {side+'UpperLeg':1}
 if z>.42:
  t=(z-.42)/.12;return {side+'LowerLeg':1-t,side+'UpperLeg':t}
 return {side+'LowerLeg':1}

def mesh(name,verts,faces,mat,weights='head',uvs=None,sub=0):
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.data.materials.append(mat)
 uv=data.uv_layers.new(name='SurfaceUV')
 for p in data.polygons:
  p.use_smooth=True
  for li in p.loop_indices:
   vi=data.loops[li].vertex_index;v=data.vertices[vi].co
   uv.data[li].uv=uvs[vi] if uvs else (v.x*.5+.5,v.z*.5)
 for v in data.vertices:
  ws=weights(v.co) if callable(weights) else {weights:1}
  for h,w in ws.items():
   if w<=.00001:continue
   group=ob.vertex_groups.get(NAMES[h]) or ob.vertex_groups.new(name=NAMES[h]);group.add([v.index],w,'REPLACE')
 # Weld the UV seam topologically before subdivision; loop UVs remain independent.
 bm=bmesh.new();bm.from_mesh(data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free();data.update()
 if sub:
  mod=ob.modifiers.new('Authored_surface_subdivision','SUBSURF');mod.levels=sub;choose(ob);bpy.ops.object.modifier_apply(modifier=mod.name)
 mod=ob.modifiers.new('Common_humanoid_skin','ARMATURE');mod.object=rig;ob.parent=rig
 objects.append(ob);return ob

def rings(name,rows,mat,weights='head',n=40,sub=1,fold=0):
 # rows: z, rx, ry, cx, cy; closed, quad strip with a UV seam.
 vs=[];uv=[];fs=[]
 for j,(z,rx,ry,cx,cy) in enumerate(rows):
  for i in range(n+1):
   t=i/n*2*pi;f=1+fold*sin(t*9+j*.4)
   vs.append((cx+sin(t)*rx*f,cy-cos(t)*ry*f,z));uv.append((i/n,j/(len(rows)-1)))
 for j in range(len(rows)-1):
  for i in range(n):
   k=j*(n+1)+i;fs.append((k,k+1,k+n+2,k+n+1))
 fs.append(tuple(reversed(range(n))));k=(len(rows)-1)*(n+1);fs.append(tuple(k+i for i in range(n)))
 return mesh(name,vs,fs,mat,weights,uv,sub)

def ellipsoid(name,c,r,mat,weights='head',n=28,m=16,sculpt=None):
 vs=[];uv=[];fs=[]
 for j in range(m+1):
  v=j/m;lat=pi*max(.0005,min(.9995,v))
  for i in range(n+1):
   t=i/n*2*pi;co=(c[0]+r[0]*sin(lat)*sin(t),c[1]-r[1]*sin(lat)*cos(t),c[2]+r[2]*cos(lat))
   vs.append(sculpt(*co) if sculpt else co);uv.append((i/n,v))
 for j in range(m):
  for i in range(n):k=j*(n+1)+i;fs.append((k,k+1,k+n+2,k+n+1))
 return mesh(name,vs,fs,mat,weights,uv)

def strand(name,points,widths,depths,mat,weights='head',n=8):
 # Tapered flattened lock / stitch / crease, shaped along a hand-authored path.
 vs=[];uv=[];fs=[];pts=[Vector(p) for p in points]
 for j,p in enumerate(pts):
  tangent=(pts[min(j+1,len(pts)-1)]-pts[max(j-1,0)]).normalized()
  ref=Vector((0,-1,0));u=tangent.cross(ref)
  if u.length<.001:u=tangent.cross(Vector((1,0,0)))
  u.normalize();v=u.cross(tangent).normalized()
  for i in range(n):
   t=2*pi*i/n;co=p+u*cos(t)*widths[j]+v*sin(t)*depths[j];vs.append(tuple(co));uv.append((i/n,j/max(1,len(pts)-1)))
 for j in range(len(pts)-1):
  for i in range(n):k=j*n+i;nn=j*n+(i+1)%n;fs.append((k,nn,nn+n,k+n))
 fs.append(tuple(reversed(range(n))));fs.append(tuple((len(pts)-1)*n+i for i in range(n)))
 return mesh(name,vs,fs,mat,weights,uv,1)

def line(name,pts,r,mat,weights='head'):
 return strand(name,pts,[r*.65]+[r]*(len(pts)-2)+[r*.5],[r*.7]*len(pts),mat,weights,n=6)

def sleeve(name,s,mat):
 rows=[(.12,.067,.060),(.18,.078,.070),(.23,.098,.084),(.30,.095,.082),(.39,.085,.078),(.445,.09,.078),(.49,.095,.080),(.54,.080,.065),(.575,.073,.060)]
 vs=[];uv=[];fs=[];n=24
 for j,(x,ry,rz) in enumerate(rows):
  for i in range(n+1):
   t=i/n*2*pi;f=1+.045*cos(t*6+j*.7);vs.append((x*s,ry*cos(t)*f,1.32+rz*sin(t)*f));uv.append((i/n,j/7))
 for j in range(len(rows)-1):
  for i in range(n):k=j*(n+1)+i;fs.append((k,k+1,k+n+2,k+n+1) if s<0 else (k+n+1,k+n+2,k+1,k))
 return mesh(name,vs,fs,mat,lambda v:arm_weights(v,s),uv,1)

# Tailored torso and limbs, no original Shino render mesh remains.
rings('SKIN_neck',[(1.30,.07,.065,0,0),(1.40,.071,.065,0,-.01),(1.49,.085,.073,0,-.025)],skin,'neck',n=24)
rings('CLOTH_tunic',[(.655,.265,.168,0,0),(.680,.270,.171,0,0),(.76,.245,.160,0,0),(.90,.196,.143,0,0),(1.02,.192,.139,0,.006),(1.15,.204,.134,0,.010),(1.27,.228,.113,0,0),(1.32,.190,.092,0,0),(1.365,.084,.073,0,-.005)],linen,torso_weights,fold=.026,n=48)
for s in [1,-1]:
 side='left' if s>0 else 'right'
 sleeve('CLOTH_'+side+'_linen_sleeve',s,linen)
 ellipsoid('SKIN_'+side+'_forearm',(.628*s,0,1.32),(.11,.059,.063),skin,lambda v,s=s:arm_weights(v,s),n=24,m=12)
 ellipsoid('SKIN_'+side+'_palm',(.752*s,-.002,1.32),(.064,.061,.034),skin,side+'Hand',n=24,m=12)
 for f,dy,length in [('Index',-.047,.081),('Middle',-.015,.095),('Ring',.019,.087),('Little',.047,.065)]:
  x=.786;points=[(s*x,dy,1.32),(s*(x+length*.35),dy,1.32),(s*(x+length*.72),dy,1.315),(s*(x+length),dy,1.305)]
  def fw(v,side=side,f=f,x=x,length=length):
   t=(abs(v.x)-x)/length
   return {side+f+('Proximal' if t<.44 else 'Intermediate' if t<.77 else 'Distal'):1}
  strand('SKIN_'+side+'_'+f,points,[.016,.015,.012,.006],[.016,.014,.011,.005],skin,fw)
 strand('SKIN_'+side+'_thumb',[(s*.724,-.03,1.31),(s*.744,-.055,1.302),(s*.772,-.08,1.304),(s*.799,-.098,1.304)],[.020,.019,.016,.007],[.017,.017,.013,.005],skin,side+'ThumbProximal')
 rings('CLOTH_'+side+'_breeches',[(.415,.096,.09,s*.121,-.006),(.45,.11,.101,s*.123,-.004),(.53,.127,.108,s*.122,0),(.65,.133,.125,s*.110,.005),(.78,.119,.131,s*.10,0),(.87,.089,.117,s*.10,0)],pants,lambda v,s=s:leg_weights(v,s),fold=.07,n=32)
 rings('CLOTH_'+side+'_sock',[(.16,.060,.057,s*.12,0),(.24,.063,.061,s*.12,0),(.36,.076,.072,s*.12,-.01),(.422,.080,.076,s*.12,-.014),(.438,.079,.075,s*.12,-.015)],socks,lambda v,s=s:leg_weights(v,s),fold=.025,n=28)
 # Boots: explicit sole, toe box, instep, shaft and turned cuff.
 for name,rows,mat in [
  ('sole',[(.018,.082,.153,s*.12,-.071),(.038,.089,.157,s*.12,-.071),(.085,.087,.150,s*.12,-.070)],sole),
  ('upper',[(.045,.084,.147,s*.12,-.07),(.094,.085,.148,s*.12,-.07),(.132,.078,.13,s*.12,-.059),(.168,.066,.094,s*.12,-.025),(.205,.064,.060,s*.12,0)],leather),
  ('shaft',[(.138,.065,.064,s*.12,0),(.20,.070,.065,s*.12,0),(.253,.077,.071,s*.12,0),(.275,.08,.072,s*.12,0)],leather),
  ('cuff',[(.242,.080,.075,s*.12,0),(.254,.086,.080,s*.12,0),(.278,.084,.079,s*.12,0),(.286,.078,.073,s*.12,0)],edge)]:
  rings('BOOT_'+side+'_'+name,rows,mat,side+'Foot' if name in ['sole','upper'] else side+'LowerLeg',n=32)
 for k in range(4):
  z=.115+k*.026;y=-.12+k*.019
  line('BOOT_'+side+'_lace'+str(k),[(s*.12-.026,y,z),(s*.12,y-.005,z+.009),(s*.12+.026,y,z)],.0032,edge,side+'Foot')
 for k in range(5):
  z=.30+k*.022
  line('SOCK_'+side+'_rib'+str(k),[(s*.12-.048,-.05,z),(s*.12,-.073,z-.002),(s*.12+.048,-.05,z)],.002,socks,side+'LowerLeg')

# Elder head: authored jaw, cheek and brow contours, with a soft sagging cheek.
headrows=[(1.398,.059,.072),(1.419,.100,.093),(1.446,.142,.117),(1.49,.172,.134),(1.545,.189,.145),(1.61,.194,.151),(1.675,.188,.149),(1.73,.184,.150),(1.79,.173,.145),(1.83,.140,.117),(1.86,.085,.075),(1.873,.015,.02)]
head=rings('SKIN_authored_head',[(z,rx,ry,0,-.037) for z,rx,ry in headrows],skin,'head',n=64,sub=1)
# Subtle cheek pads are part of the head mesh, never separate button-like spheres.
for v in head.data.vertices:
 if v.co.y<-.08:v.co.y-=.012*exp(-((abs(v.co.x)-.112)/.055)**2-((v.co.z-1.575)/.055)**2)
# Modest sculpted nose; intersections are buried inside the face.
for s in [-1,1]:
 # Cheek volume is sculpted into the continuous head surface below.
 ellipsoid('SKIN_ear_'+str(s),(.195*s,-.018,1.615),(.036,.027,.062),skin,'head',n=24,m=14)
 ellipsoid('FACE_ear_inner_'+str(s),(.216*s,-.032,1.62),(.015,.01,.039),blush,'head',n=16,m=12)
 line('FACE_closed_eye_'+str(s),[(s*.041,-.189,1.654),(s*.063,-.195,1.662),(s*.090,-.195,1.664),(s*.117,-.188,1.655)],.0034,eye)
 strand('HAIR_brow_'+str(s),[(s*.039,-.179,1.701),(s*.065,-.187,1.714),(s*.093,-.184,1.717),(s*.124,-.170,1.706)],[.007,.012,.011,.002],[.004,.006,.005,.001],hairlight)
 for k in range(2):
  line('FACE_crows_foot_'+str(s)+'_'+str(k),[(s*.122,-.180,1.644-k*.008),(s*.141,-.170,1.647-k*.010),(s*.151,-.157,1.65-k*.011)],.0015,blush)
 line('FACE_smile_fold_'+str(s),[(s*.053,-.188,1.563),(s*.072,-.191,1.541),(s*.074,-.18,1.517)],.0016,blush)
 for k in range(2):
  line('FACE_under_eye_'+str(s)+'_'+str(k),[(s*.049,-.190,1.635-k*.009),(s*.080,-.197,1.628-k*.008),(s*.111,-.184,1.632-k*.008)],.0013,blush)
ellipsoid('SKIN_nose_bridge',(0,-.179,1.628),(.024,.035,.052),skin,n=28,m=16)
ellipsoid('SKIN_nose_tip',(0,-.215,1.593),(.040,.037,.029),skin,n=28,m=16)
for s in [-1,1]:ellipsoid('FACE_nostril_'+str(s),(.027*s,-.229,1.580),(.010,.006,.005),blush,n=12,m=8)
line('FACE_gentle_smile',[(-.05,-.17,1.517),(-.027,-.181,1.507),(0,-.186,1.504),(.027,-.181,1.507),(.05,-.17,1.517)],.0028,eye)
# Receding, asymmetric short silver hair. A genuine scalp shell and tapered locks.
vs=[];uv=[];fs=[];N=64;J=16
for j in range(J+1):
 for i in range(N+1):
  t=i/N*2*pi;front=max(0,cos(t));back=max(0,-cos(t))
  end=1.85-.90*front+.38*back+.055*sin(t*7+.3)
  lat=.012+(end-.012)*j/J
  z=1.638+.242*cos(lat)
  if z>=headrows[-1][0]:rx,ry=.008,.010
  else:
   lo,hi=next((headrows[k],headrows[k+1]) for k in range(len(headrows)-1) if headrows[k][0]<=z<=headrows[k+1][0])
   f=(z-lo[0])/(hi[0]-lo[0]);rx=lo[1]*(1-f)+hi[1]*f;ry=lo[2]*(1-f)+hi[2]*f
  x=(rx+.006)*sin(t);y=-.037-(ry+.006)*cos(t)
  vs.append((x,y,z));uv.append((i/N,j/J))
for j in range(J):
 for i in range(N):k=j*(N+1)+i;fs.append((k+N+1,k+N+2,k+1,k))
mesh('HAIR_receding_silver_cap',vs,fs,hair,'head',uv,1)
for s in [-1,1]:
 for k in range(9):
  t=.47+k*.26
  x=s*(.19*sin(t));y=-.025-.155*cos(t);z=1.758-.095*(k/8)
  strand('HAIR_side_'+str(s)+'_'+str(k),[(x*.83,y*.9,z+.074),(x,y,z+.038),(x+s*(.035+.006*sin(k)),y-.005,z), (x+s*.022,y+.012,z-.044-.018*sin(k*2))],[.015,.024+.005*sin(k*2),.014,.001],[.008,.011,.007,.001],hairlight if k%3==0 else hair)
 # Sideburns reach cheekbone, not a large fantasy beard.
 strand('HAIR_sideburn_'+str(s),[(s*.183,-.075,1.667),(s*.195,-.09,1.62),(s*.182,-.113,1.565)],[.019,.025,.002],[.011,.014,.001],hairlight)
 # Uneven moustache locks leave the friendly smile visible.
 for k in range(3):
  strand('HAIR_moustache_'+str(s)+'_'+str(k),[(s*(.010+k*.010),-.192,1.557),(s*(.033+k*.012),-.196,1.547),(s*(.051+k*.014),-.180,1.535)],[.005,.009,.001],[.004,.005,.001],hairlight,n=6)
# A single skin-following chin beard, with an irregular tapered edge.
cv=[];cf=[];cu=[]
for j in range(9):
 v=j/8;z=1.494-.067*v
 for i in range(17):
  u=i/16*2-1;x=u*max(.001,.061*sin(pi*v)**.45*(1-.35*v))
  lo,hi=next((headrows[k],headrows[k+1]) for k in range(len(headrows)-1) if headrows[k][0]<=z<=headrows[k+1][0])
  t=(z-lo[0])/(hi[0]-lo[0]);rx=lo[1]*(1-t)+hi[1]*t;ry=lo[2]*(1-t)+hi[2]*t
  y=-.037-ry*max(.001,1-(x/rx)**2)**.5-.004
  cv.append((x,y,z+.003*sin(i*2.3)*v*v));cu.append((i/16,v))
for j in range(8):
 for i in range(16):k=j*17+i;cf.append((k+17,k+18,k+1,k))
mesh('HAIR_soft_chin_beard',cv,cf,hairlight,'head',cu,1)
# Forehead creases, deliberately shallow and broken.
for k in range(2):
 line('FACE_forehead_crease'+str(k),[(-.07,-.16,1.76+k*.018),(-.025,-.181,1.769+k*.015),(.025,-.181,1.77+k*.015),(.065,-.164,1.765+k*.015)],.0011,blush)

# Open wrap: anisotropic drape, neck opening, asymmetric hanging front panels.
vs=[];uv=[];fs=[];N=64;J=12;start=.37
for j in range(J+1):
 v=j/J
 for i in range(N+1):
  t=start+(2*pi-2*start)*i/N
  front=max(0,cos(t));side=abs(sin(t));back=max(0,-cos(t))
  ztop=1.418-.025*side;zbottom=.92-.08*back+.035*sin(t*2+.4)
  rx=.084+(.331-.084)*sin(v*pi/2)**.45;ry=.088+(.179-.088)*v
  x=sin(t)*rx*(1+.026*sin(t*11+v));y=-cos(t)*ry+.015-.028*max(0,cos(t))
  z=ztop*(1-v)+zbottom*v+.016*sin(t*8+.8)*v*v
  vs.append((x,y,z));uv.append((i/N,v))
for j in range(J):
 for i in range(N):k=j*(N+1)+i;fs.append((k,k+1,k+N+2,k+N+1))
wrap=mesh('CLOTH_moss_shoulder_wrap',vs,fs,olive,torso_weights,uv,1)
# Thickness is authored into the export, not a double-sided lighting trick.
choose(wrap);mod=wrap.modifiers.new('Wool_fabric_thickness','SOLIDIFY');mod.thickness=.008;mod.offset=0;bpy.ops.object.modifier_apply(modifier=mod.name)
# Hem binding follows the same sampled cloth edge. Short fringe follows the sheet.
hem=[Vector(vs[J*(N+1)+i]) for i in range(N+1)]
line('CLOTH_shawl_bound_hem',[tuple(p) for p in hem],.005,oliveEdge,torso_weights)
for i in range(0,N+1,2):
 p=hem[i];strand('CLOTH_fringe_'+str(i),[tuple(p),tuple(p+Vector((.002*sin(i),0,-.018))),tuple(p+Vector((.004*sin(i),0,-.037-.01*sin(i*1.7))))],[.0035,.003,.001],[.0025,.002,.001],oliveEdge,torso_weights,n=5)
# Brown scarf collar, two non-identical hanging tails, creased rather than tubular.
rings('CLOTH_scarf_collar',[(1.34,.109,.090,0,-.008),(1.36,.124,.105,0,-.012),(1.399,.127,.105,0,-.012),(1.426,.105,.084,0,-.012)],scarf,'upperChest',n=40,fold=.065)
for s,l in [(1,.38),(-1,.48)]:
 points=[(s*.084,-.13,1.38),(s*.10,-.171,1.24),(s*.078,-.18,1.10),(s*.092,-.174,1.38-l)]
 cv=[];cf=[];cu=[]
 for j in range(13):
  v=j/12
  for i in range(9):
   u=i/8-.5;x=s*(.084+.012*sin(v*4)) + u*(.112-.023*v)
   y=-.135-.047*sin(v*pi/2)+.005*cos(u*5*pi+v*2)
   z=1.38-l*v+.008*sin(u*4+1)*v*v
   cv.append((x,y,z));cu.append((i/8,v))
 for j in range(12):
  for i in range(8):k=j*9+i;cf.append((k+9,k+10,k+1,k))
 tail=mesh('CLOTH_scarf_tail_'+str(s),cv,cf,scarf,torso_weights,cu,1)
 choose(tail);th=tail.modifiers.new('Woven_scarf_thickness','SOLIDIFY');th.thickness=.006;bpy.ops.object.modifier_apply(modifier=th.name)
 for k in range(5):
  x=s*.092+(k-2)*.013
  line('CLOTH_scarf_fringe_'+str(s)+'_'+str(k),[(x,-.174,1.38-l),(x+.003,-.177,1.35-l)],.0026,seam,torso_weights)
# Center opening, stitches, cuffs, belt and pouch construction.
line('CLOTH_tunic_placket',[(0,-.107,1.31),(0,-.146,1.17),(0,-.15,1.00),(0,-.147,.87),(0,-.164,.695)],.0035,seam,torso_weights)
for k in range(4):ellipsoid('ACC_tunic_button'+str(k),(.018,-.153,1.19-k*.071),(.006,.004,.006),edge,torso_weights,n=12,m=8)
for s in [-1,1]:
 line('CLOTH_tunic_hem'+str(s),[(s*.014,-.162,.69),(s*.095,-.143,.69),(s*.178,-.091,.69),(s*.224,0,.69)],.003,seam,'hips')
rings('ACC_leather_belt',[(.831,.237,.163,0,0),(.844,.236,.162,0,0),(.871,.230,.158,0,0),(.879,.228,.157,0,0)],leather,'hips',n=48,sub=0)
# Buckle path with open center.
line('ACC_belt_buckle',[(-.029,-.168,.833),(-.029,-.168,.88),(.029,-.168,.88),(.029,-.168,.833),(-.029,-.168,.833)],.004,brass,'hips')
line('ACC_belt_tongue',[(0,-.172,.837),(0,-.172,.875)],.0025,brass,'hips')
rings('ACC_belt_pouch',[(.65,.065,.027,-.221,-.028),(.67,.079,.041,-.225,-.028),(.77,.079,.045,-.225,-.028),(.817,.066,.04,-.219,-.028)],leather,'hips',n=32)
strand('ACC_pouch_flap',[(-.218,-.037,.831),(-.227,-.072,.803),(-.227,-.079,.753)],[.065,.078,.045],[.008,.010,.008],edge,'hips',n=10)
ellipsoid('ACC_pouch_clasp',(-.227,-.09,.769),(.009,.005,.013),brass,'hips',n=12,m=8)

# Save the editable, separated authored surfaces before an export-only material merge.
for ob in objects:ob['surface_family']=ob.name.split('_')[0];ob['authorship']='Original elder concept adaptation; no Shino render geometry'
rig['sourceRig']=str(SOURCE.relative_to(ROOT));rig['sourceRigSha256']=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
rig['reference']='docs/characters/references/npc-role-set/elderly-man.avif'
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.cycles.device='CPU';scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=960;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Neutral_studio');scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.24,.28,.31,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.65
scene.view_settings.view_transform='AgX'
BLEND=OUT/'ElderlyMan.blend';bpy.ops.wm.save_as_mainfile(filepath=str(BLEND),compress=True)
# Export groups per material, preserving every weight and UV; keep source components intact.
exports=[]
for mat in MATS.values():
 members=[ob for ob in objects if ob.data.materials[0]==mat]
 if not members:continue
 copies=[]
 for ob in members:
  cp=ob.copy();cp.data=ob.data.copy();scene.collection.objects.link(cp);copies.append(cp)
 bpy.ops.object.select_all(action='DESELECT')
 for cp in copies:cp.select_set(True)
 bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();merged=bpy.context.object;merged.name='Elder_'+mat.name;exports.append(merged)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for ob in exports:ob.select_set(True)
bpy.context.view_layer.objects.active=rig
GLB=OUT/'ElderlyMan.glb'
bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_apply=False,export_yup=True)
# Add VRM1 semantic bone mapping and inherited rig usage metadata, without copying source expressions.
doc,chunks=read_glb(GLB);nodeids={n.get('name'):i for i,n in enumerate(doc['nodes'])}
human={h:{'node':nodeids[name]} for h,name in NAMES.items() if name in nodeids}
if len(human)!=54:raise RuntimeError(f'Expected 54 humanoid bones, got {len(human)}')
meta=dict(src['extensions']['VRMC_vrm']['meta']);meta.update(name='Rinne_Elderly_Man_DCC',version='1.0',authors=['RINNE original elder surfaces','VRoid Project / pixiv Inc. and coati: humanoid naming/provenance'])
meta.pop('thumbnailImage',None)
meta['otherLicenseUrl']='https://github.com/charukun/soul-lineage/blob/work/visual-review-lab-v2/apps/rinne/docs/ELDER_REFERENCE_DCC.md'
doc.setdefault('extensions',{})['VRMC_vrm']={'specVersion':'1.0','meta':meta,'humanoid':{'humanBones':human}}
doc['extensionsUsed']=list(dict.fromkeys(doc.get('extensionsUsed',[])+['VRMC_vrm']))
doc['asset']['copyright']='Original RINNE elder surfaces, generated reference sheet; humanoid metadata derived from audited Sendagaya_Shino under its retained VRM terms.'
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
payload=struct.pack('<II',len(j),0x4E4F534A)+j
for t,b in chunks:payload+=struct.pack('<II',len(b),t)+b
VRM=PUBLIC/'ELDER_REFERENCE_V1.vrm';VRM.write_bytes(struct.pack('<4sII',b'glTF',2,12+len(payload))+payload)
GLB.unlink()
for ob in exports:bpy.data.objects.remove(ob,do_unlink=True)
# Neutral studio, identical lighting in every view.
def aim(ob,target):ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-4,1));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=2.14;scene.camera=cam
for loc,power,size,col in [((-2,-3,4),260,3,(1,.90,.78)),((3,-1,2.8),190,3,(.8,.89,1)),((1,2,3.5),240,2,(1,.91,.79))]:
 bpy.ops.object.light_add(type='AREA',location=loc);ob=bpy.context.object;ob.data.energy=power;ob.data.shape='DISK';ob.data.size=size;ob.data.color=col;aim(ob,(0,0,1))
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,.005));floor=bpy.context.object;floor.name='STUDIO_floor';floor.data.materials.append(material('STUDIO_sand',(.19,.17,.13),.9))
def pose(values):
 for pb in rig.pose.bones:pb.rotation_mode='QUATERNION';pb.rotation_quaternion=(1,0,0,0)
 for h,rot in values.items():
  rest=rig.data.bones[NAMES[h]].matrix_local.to_quaternion();rig.pose.bones[NAMES[h]].rotation_quaternion=rest.inverted() @ Euler(rot,'XYZ').to_quaternion() @ rest
 bpy.context.view_layer.update()
# Rest armature is T; visual neutral lowers both upper arms, without altering bind data.
neutral={'leftUpperArm':(0,1.12,0),'rightUpperArm':(0,-1.12,0)}
views={'front':(0,-4,1),'three-quarter':(3,-4,1.4),'side':(4,0,1),'back':(0,4,1)}
if not a.no_render:
 pose(neutral)
 for name,pos in views.items():
  cam.location=pos;cam.data.ortho_scale=2.13;aim(cam,(0,0,.99));scene.render.filepath=str(QA/(name+'.png'));bpy.ops.render.render(write_still=True)
 cam.location=(0,-4,1.65);cam.data.ortho_scale=.67;aim(cam,(0,-.04,1.65));scene.render.filepath=str(QA/'face.png');bpy.ops.render.render(write_still=True)
 pose({**neutral,'leftLowerArm':(0,0,-.8),'rightLowerLeg':(.9,0,0),'head':(0,0,.4)})
 cam.location=(3,-4,1.4);cam.data.ortho_scale=2.18;aim(cam,(0,0,1));scene.render.filepath=str(QA/'deformation.png');bpy.ops.render.render(write_still=True)
pose({})
tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects)
report={'schema':'elder-reference-dcc-build','version':1,'blender':bpy.app.version_string,'meshComponents':len(objects),'triangles':tris,'materials':len(MATS)-1,'humanoidBones':len(human),'bytes':VRM.stat().st_size,'assetSha256':hashlib.sha256(VRM.read_bytes()).hexdigest(),'sourceSha256':hashlib.sha256(BLEND.read_bytes()).hexdigest(),'visualApproval':'pending','productionReady':False,'renderedViews':list(views)+['face','deformation'] if not a.no_render else []}
(QA/'build.json').write_text(json.dumps(report,indent=2)+'\n');print('ELDER_BUILD',json.dumps(report))
