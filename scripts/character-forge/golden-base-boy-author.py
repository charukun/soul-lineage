"""Golden Base Boy: actual Blender DCC refinement of a failed Forge candidate.
The source measurements below are authored hypotheses fitted to the three central
figures, not automated joint detections. No external character mesh is imported.
"""
import bpy, bmesh, json, math, os
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
PKG=ROOT/'packages/assets/characters/forge/golden-base-boy-v1'
WORK=ROOT/'.dcc-work/golden-base-boy-v1'; WORK.mkdir(parents=True,exist_ok=True)
ROUND=int(os.environ.get('GOLDEN_DCC_ROUND','1'))
DCC=PKG/'source/dcc'; DCC.mkdir(parents=True,exist_ok=True)
# Retain the initial imported candidate and its real renders as round zero.
if not (DCC/'pipeline-import.blend').exists(): raise RuntimeError('Run actual Forge intake and initial Blender inspection first')
bpy.ops.wm.read_factory_settings(use_empty=True)
PARTS=[]

def active(obj):
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj

def mesh(name,verts,faces,role):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
    obj['basePart']=role; obj['authorship']='original reference-fitted Blender DCC geometry'
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
    for p in data.polygons:p.use_smooth=True
    PARTS.append(obj);return obj

def ellipsoid(name,center,radii,role='skin',seg=24,rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=center)
    o=bpy.context.object;o.name=name;o.scale=radii;active(o);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    # Geometry is kept in world-space coordinates for the existing Forge exporter.
    for v in o.data.vertices:v.co+=o.location
    o.location=(0,0,0);o['basePart']=role;PARTS.append(o)
    for p in o.data.polygons:p.use_smooth=True
    return o

def loft(name,rows,role='skin',sides=32):
    # rows: z, radiusX, frontY, backY, optional centerX
    verts=[];faces=[]
    for row in rows:
        z,rx,front,back=row[:4];cx=row[4] if len(row)>4 else 0;cy=(front+back)/2;ry=(back-front)/2
        for j in range(sides):
            a=2*math.pi*j/sides;verts.append((cx+rx*math.sin(a),cy-ry*math.cos(a),z))
    for i in range(len(rows)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
    for ring,reverse in [(0,True),(len(rows)-1,False)]:
        points=verts[ring*sides:(ring+1)*sides];c=len(verts);verts.append(tuple(sum(p[k] for p in points)/sides for k in range(3)))
        for j in range(sides):
            a=ring*sides+j;b=ring*sides+(j+1)%sides;faces.append((c,b,a) if reverse else (c,a,b))
    return mesh(name,verts,faces,role)

def tube(name,centers,radii,role='skin',sides=12):
    verts=[];faces=[];cs=[Vector(p) for p in centers]
    for i,c in enumerate(cs):
        direction=(cs[min(i+1,len(cs)-1)]-cs[max(0,i-1)]).normalized()
        e=direction.cross(Vector((0,1,0)))
        if e.length<.01:e=direction.cross(Vector((1,0,0)))
        e.normalize();f=direction.cross(e).normalized()
        r=radii[i];r1,r2=(r,r) if isinstance(r,(int,float)) else r
        for j in range(sides):
            a=2*math.pi*j/sides;verts.append(tuple(c+e*(r1*math.cos(a))+f*(r2*math.sin(a))))
    for i in range(len(cs)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides;faces.append((a,a+sides,b+sides,b))
    for ring in (0,len(cs)-1):
        c=len(verts);verts.append(tuple(cs[ring]))
        for j in range(sides):faces.append((c,ring*sides+j,ring*sides+(j+1)%sides))
    return mesh(name,verts,faces,role)

# Body, fingers and toes form one connected skin surface after voxel union and
# quadrangulation. The gray region is painted on this surface, not a garment.
body_parts=[]
body_parts.append(loft('Body volume',[(.451,.067,-.045,.055),(.49,.146,-.086,.10),(.55,.18,-.107,.131),(.62,.164,-.11,.127),(.70,.134,-.098,.109),(.77,.127,-.106,.098),(.835,.143,-.104,.082),(.895,.145,-.079,.069),(.923,.112,-.055,.052),(.947,.047,-.043,.047),(.997,.051,-.047,.051)]))
finger_paths={}
for side,sgn in [('L',1),('R',-1)]:
    flip=lambda p:(sgn*p[0],p[1],p[2])
    arm=[(.127,0,.898),(.173,0,.884),(.224,0,.863),(.278,-.001,.833),(.305,-.003,.82),(.36,-.006,.798),(.422,-.008,.777),(.445,-.008,.774)]
    body_parts.append(tube('Arm '+side,[flip(p) for p in arm],[.047,.060,.05,.038,.035,.039,.026,.020],sides=20))
    body_parts.append(ellipsoid('Palm '+side,flip((.463,-.007,.774)),(.035,.034,.018)))
    fingers={
      'index':[(.477,-.025,.777),(.496,-.029,.78),(.513,-.031,.78),(.526,-.032,.779)],
      'middle':[(.481,-.007,.778),(.502,-.007,.78),(.522,-.007,.78),(.537,-.007,.778)],
      'ring':[(.478,.010,.777),(.497,.013,.779),(.514,.015,.778),(.528,.016,.776)],
      'little':[(.471,.026,.775),(.487,.030,.776),(.501,.032,.775),(.512,.033,.773)],
      'thumb':[(.447,-.029,.771),(.460,-.044,.77),(.477,-.052,.77),(.486,-.055,.772)]}
    for fname,points in fingers.items():
        pts=[flip(p) for p in points];finger_paths[(side,fname)]=pts
        body_parts.append(tube(fname+' '+side,pts,[.0095,.0085,.0073,.0038],sides=10))
        body_parts.append(ellipsoid(fname+' tip '+side,pts[-1],(.0048,.0053,.0053),seg=12,rings=8))
    rows=[(.079,.038,-.024,.057,.11),(.12,.043,-.026,.064,.11),(.192,.062,-.034,.092,.111),(.241,.061,-.046,.079,.112),(.289,.051,-.045,.060,.108),(.323,.056,-.06,.062,.109),(.402,.077,-.075,.081,.107),(.493,.082,-.077,.098,.102),(.545,.08,-.069,.108,.094)]
    body_parts.append(loft('Leg '+side,[(z,rx,f,b,sgn*x) for z,rx,f,b,x in rows],sides=24))
    body_parts.append(ellipsoid('Foot '+side,flip((.11,-.035,.041)),(.055,.11,.039),seg=24,rings=12))
    for i in range(5):
        x=.079+i*.018;y=-.125+max(0,i-1)*.007;r=.0127-i*.0013
        body_parts.append(ellipsoid('Toe '+str(i)+' '+side,flip((x,y,.025)),(r,.027-i*.002,.014),seg=12,rings=8))
for o in body_parts:o.select_set(True)
active(body_parts[0])
for o in body_parts:o.select_set(True)
bpy.ops.object.join();body=bpy.context.object;body.name='GoldenBaseBody';body['basePart']='body'
PARTS=[body]
body.data.remesh_voxel_size=.0035;body.data.remesh_voxel_adaptivity=0
active(body);bpy.ops.object.voxel_remesh()
smooth=body.modifiers.new('Union relaxation','SMOOTH');smooth.factor=.65;smooth.iterations=4;bpy.ops.object.modifier_apply(modifier=smooth.name)
props={p.identifier for p in bpy.ops.object.quadriflow_remesh.get_rna_type().properties}
settings={'target_faces':5200,'use_mesh_symmetry':True,'use_preserve_sharp':False,'use_preserve_boundary':False,'smooth_normals':True,'seed':0}
res=bpy.ops.object.quadriflow_remesh(**{k:v for k,v in settings.items() if k in props})
if 'FINISHED' not in res:raise RuntimeError('Body quadrangulation failed; do not publish the voxel intermediate')
for p in body.data.polygons:p.use_smooth=True
floor=min(v.co.z for v in body.data.vertices)
for v in body.data.vertices:v.co.z-=floor

# Smooth reference-fitted head: drawn head/body ratio has priority over the
# decorative 3.5-head label printed elsewhere on the sheet.
PROFILE=np.array([[.974,.031,-.069,.086],[.988,.081,-.148,.107],[1.012,.151,-.213,.148],[1.061,.211,-.261,.202],[1.13,.269,-.272,.253],[1.20,.298,-.276,.288],[1.30,.307,-.299,.320],[1.40,.289,-.294,.322],[1.50,.223,-.247,.268],[1.575,.125,-.155,.157],[1.596,.034,-.033,.037],[1.600,.001,-.001,.001]])
def profile(z):
    k=max(0,min(len(PROFILE)-2,int(np.searchsorted(PROFILE[:,0],z)-1)))
    t=max(0,min(1,(z-PROFILE[k,0])/(PROFILE[k+1,0]-PROFILE[k,0])))
    # Cubic Hermite with finite-difference tangents; monotone radii capped at .31.
    p0=PROFILE[max(k-1,0)];p1=PROFILE[k];p2=PROFILE[k+1];p3=PROFILE[min(k+2,len(PROFILE)-1)]
    a=(p2[1:]-p0[1:])/max(p2[0]-p0[0],1e-6)*(p2[0]-p1[0]);b=(p3[1:]-p1[1:])/max(p3[0]-p1[0],1e-6)*(p2[0]-p1[0])
    value=(2*t**3-3*t*t+1)*p1[1:]+(t**3-2*t*t+t)*a+(-2*t**3+3*t*t)*p2[1:]+(t**3-t*t)*b
    return float(max(.001,value[0])),float(value[1]),float(value[2])
def face_y(x,z):
    rx,front,back=profile(z);cy=(front+back)/2;ry=(back-front)/2
    y=cy-ry*math.sqrt(max(0,1-(x/rx)**2))
    y-=.018*math.exp(-(x/.024)**2-((z-1.089)/.027)**2)
    return y
zs=np.linspace(.974,1.600,45)
head=loft('GoldenBaseHead',[(float(z),*profile(float(z))) for z in zs],'head',64)
for v in head.data.vertices:
    if v.co.y<0:v.co.y-=.018*math.exp(-(v.co.x/.024)**2-((v.co.z-1.089)/.027)**2)*max(0,-v.co.y/.20)
for side,s in [('L',1),('R',-1)]:
    ellipsoid('Ear '+side,(s*.296,.032,1.132),(.046,.032,.061),'ear',32,20)
    ellipsoid('Ear bowl '+side,(s*.306,-.0005,1.134),(.029,.008,.040),'ear-inner',24,14)

# Closed curved ocular surfaces. They are actual 3D geometry and support
# geometric blendshapes; neither eye nor expression is an image billboard.
EYES={}
def lens(name,cx,cz,rx,rz,role,base_fn,bulge=.009,rings=8,sides=40):
    verts=[(cx,base_fn(cx,cz)-bulge,cz)];faces=[]
    for i in range(1,rings+1):
        r=i/rings
        for j in range(sides):
            a=2*math.pi*j/sides;x=cx+rx*r*math.cos(a);z=cz+rz*r*math.sin(a)
            verts.append((x,base_fn(x,z)-bulge*(1-r*r),z))
    for j in range(sides):faces.append((0,1+j,1+(j+1)%sides))
    for i in range(rings-1):
        a=1+i*sides;b=a+sides
        for j in range(sides):faces.append((a+j,b+j,b+(j+1)%sides,a+(j+1)%sides))
    start=1+(rings-1)*sides;rear=len(verts)
    for j in range(sides):
        p=verts[start+j];verts.append((p[0],p[1]+.005,p[2]))
    for j in range(sides):faces.append((start+j,rear+j,rear+(j+1)%sides,start+(j+1)%sides))
    c=len(verts);verts.append((cx,base_fn(cx,cz)+.006,cz))
    for j in range(sides):faces.append((c,rear+(j+1)%sides,rear+j))
    o=mesh(name,verts,faces,role);o['eyeCenter']=[cx,cz];return o
for side,s in [('L',1),('R',-1)]:
    cx=s*.125;cz=1.153;EYES[side]=[]
    eye_fn=lambda x,z:face_y(x,z)-.004
    iris_fn=lambda x,z,cx=cx,cz=cz:face_y(x,z)-.004-.014*max(0,1-((x-cx)/.061)**2-((z-cz)/.057)**2)-.0018
    white=lens('Eye white '+side,cx,cz,.061,.057,'eye-white',eye_fn,.014)
    iris=lens('Iris '+side,cx,cz-.001,.043,.054,'iris',iris_fn,.002,8)
    EYES[side]+=[white,iris]
    pupil=lens('Pupil '+side,cx,cz-.001,.0085,.027,'pupil',lambda x,z:iris_fn(x,z)-.003,.001,4,24);EYES[side].append(pupil)
    for i,(dx,dz,r) in enumerate([(-.014,.024,.010),(.016,-.023,.0045)]):
        h=lens('Catchlight '+str(i)+' '+side,cx+dx,cz+dz,r,r*1.12,'highlight',lambda x,z:iris_fn(x,z)-.005,.001,3,16);EYES[side].append(h)
    points=[]
    for a in np.linspace(0,math.pi,25):
        x=cx+.063*math.cos(float(a));z=cz+.055*math.sin(float(a));points.append((x,face_y(x,z)-.009,z))
    lash=tube('Upper lid '+side,points,[.0038+.0018*math.sin(math.pi*i/24) for i in range(25)],'lash',8);lash['eyeCenter']=[cx,cz];EYES[side].append(lash)
    wing=[(cx+s*.058,face_y(cx+s*.058,cz+.014)-.009,cz+.014),(cx+s*.077,face_y(cx+s*.071,cz+.015)-.011,cz+.020),(cx+s*.069,face_y(cx+s*.066,cz+.021)-.010,cz+.026)]
    w=tube('Lash wing '+side,wing,[.004,.001,.001],'lash',8);w['eyeCenter']=[cx,cz];EYES[side].append(w)
    lower=[]
    for a in np.linspace(math.pi,2*math.pi,21):
        x=cx+.059*math.cos(float(a));z=cz+.054*math.sin(float(a));lower.append((x,face_y(x,z)-.007,z))
    l=tube('Lower lid '+side,lower,[.0016]*len(lower),'lower-lid',6);l['eyeCenter']=[cx,cz];EYES[side].append(l)
    brow=[]
    for t in np.linspace(-1,1,18):
        x=cx+float(t)*.052;z=1.293+.009*(1-t*t);brow.append((x,face_y(x,z)-.003,z))
    tube('Brow '+side,brow,[.0018+.0006*math.sin(math.pi*i/17) for i in range(18)],'brow',6)

mouth_center=1.043
mouth=lens('Mouth opening',0,mouth_center,.030,.003,'mouth',lambda x,z:face_y(x,z)-.002,.001,4,32)
outline=[]
for t in np.linspace(-1,1,25):
    x=float(t)*.032;z=mouth_center+.006*t*t;outline.append((x,face_y(x,z)-.004,z))
lip=tube('Mouth rim',outline,[.0015]*len(outline),'lip',6)

# Reference-fitted rest rig, preserving the Forge runtime's canonical hierarchy.
bones=[]
def bone(name,parent,head,tail):bones.append({'name':name,'parent':parent,'head':list(head),'tail':list(tail)})
bone('root',None,(0,0,0),(0,0,.1));bone('hips','root',(0,0,.51),(0,0,.69));bone('spine','hips',(0,0,.69),(0,0,.85));bone('chest','spine',(0,0,.85),(0,0,.945));bone('neck','chest',(0,0,.945),(0,0,1.0));bone('head','neck',(0,0,1.0),(0,0,1.57))
for side,s in [('L',1),('R',-1)]:
    bone('shoulder.'+side,'chest',(s*.09,0,.903),(s*.149,0,.892))
    bone('upperArm.'+side,'shoulder.'+side,(s*.149,0,.892),(s*.285,-.002,.827))
    bone('lowerArm.'+side,'upperArm.'+side,(s*.285,-.002,.827),(s*.426,-.008,.777))
    bone('hand.'+side,'lowerArm.'+side,(s*.426,-.008,.777),(s*.476,-.008,.775))
    bone('upperLeg.'+side,'hips',(s*.109,.015,.53),(s*.109,.005,.295))
    bone('lowerLeg.'+side,'upperLeg.'+side,(s*.109,.005,.295),(s*.11,.019,.088))
    bone('foot.'+side,'lowerLeg.'+side,(s*.11,.019,.088),(s*.11,-.125,.025))
for (side,finger),pts in finger_paths.items():
    for i in range(3):bone(finger+str(i+1)+'.'+side,'hand.'+side if i==0 else finger+str(i)+'.'+side,pts[i],pts[i+1])
armdata=bpy.data.armatures.new('Golden Base fitted Forge rig');arm=bpy.data.objects.new('GoldenBaseRig',armdata);bpy.context.collection.objects.link(arm);active(arm);bpy.ops.object.mode_set(mode='EDIT')
for b in bones:
    e=armdata.edit_bones.new(b['name']);e.head=b['head'];e.tail=b['tail']
    if b['parent']:e.parent=armdata.edit_bones[b['parent']]
bpy.ops.object.mode_set(mode='OBJECT');arm.show_in_front=True
arm['rigContract']='rinne.forge.humanoid.v1';arm['profile']='rinne.golden-base-boy.v1';arm['externalGoldenRigVerified']=False
bone_index={b['name']:i for i,b in enumerate(bones)}

def distance(p,a,b):
    a=Vector(a);b=Vector(b);d=b-a;t=max(0,min(1,(p-a).dot(d)/max(d.length_squared,1e-8)));return (p-a-t*d).length

def weights(p,role):
    if role!='body':return [bone_index['head'],0,0,0],[1.,0.,0.,0.]
    side='L' if p.x>=0 else 'R';x=abs(p.x)
    if p.z<.48:
        names=['hips','upperLeg.'+side,'lowerLeg.'+side,'foot.'+side]
    elif x>.19 and p.z>.70:
        names=['upperArm.'+side,'lowerArm.'+side,'hand.'+side]
        if x>.438:names+= [b['name'] for b in bones if b['name'].endswith('.'+side) and any(b['name'].startswith(f) for f in ('thumb','index','middle','ring','little'))]
    elif p.z>.91:names=['chest','neck','head','shoulder.'+side]
    else:names=['hips','spine','chest','shoulder.'+side,'upperLeg.'+side,'upperArm.'+side]
    ds=sorted((distance(p,bones[bone_index[n]]['head'],bones[bone_index[n]]['tail']),bone_index[n]) for n in names)[:4]
    sigma=.015 if x>.44 else .027
    w=[math.exp(-((d-ds[0][0])/sigma)**2*1.7) for d,i in ds];total=sum(w);idx=[i for d,i in ds]
    w=[v/total for v in w]
    while len(w)<4:w.append(0);idx.append(0)
    return idx,w

MORPHS=['Blink.L','Blink.R','Smile','MouthOpen']
# Actual geometric shape keys on the native editable source and eventual GLB.
for o in PARTS:
    o.shape_key_add(name='Basis')
    for name in MORPHS:
        key=o.shape_key_add(name=name)
        side='L' if o.name.endswith(' L') else 'R' if o.name.endswith(' R') else None
        ocular=side in EYES and o in EYES[side]
        if ocular and (name=='Blink.'+side or name=='Smile'):
            cx,cz=o['eyeCenter'];happy=name=='Smile'
            for v in key.data:
                x=v.co.x;arc=(.010 if happy else -.001)*(1-min(1,((x-cx)/.069)**2))
                v.co.z=cz+arc+(v.co.z-cz)*.012
                v.co.y=face_y(v.co.x,v.co.z)+(.006 if o['basePart'] not in ('lash','lower-lid') else -.006)
        elif o==mouth and name=='MouthOpen':
            for v in key.data:
                dz=(v.co.z-mouth_center)/.003;v.co.z=mouth_center-.009+dz*.025
                v.co.y=face_y(v.co.x,v.co.z)-.005
        elif o==lip and name=='MouthOpen':
            # Neutral smile line becomes the lower lip of the opened mouth.
            for v in key.data:
                v.co.z=mouth_center-.009-.025*math.sqrt(max(0,1-(v.co.x/.033)**2));v.co.y=face_y(v.co.x,v.co.z)-.006
        elif o in (mouth,lip) and name=='Smile':
            for v in key.data:
                v.co.z+=.007*(abs(v.co.x)/.032)**2;v.co.y=face_y(v.co.x,v.co.z)-.004
        elif o==head and name=='MouthOpen':
            for v in key.data:
                w=math.exp(-(v.co.x/.085)**2-((v.co.z-1.018)/.050)**2)*max(0,min(1,-v.co.y/.17));v.co.z-=.007*w
    for b in bones:o.vertex_groups.new(name=b['name'])
    for v in o.data.vertices:
        ii,ww=weights(v.co,o['basePart'])
        for i,w in zip(ii,ww):
            if w>0:o.vertex_groups[bones[i]['name']].add([v.index],w,'REPLACE')
    mod=o.modifiers.new('Golden fitted deformation','ARMATURE');mod.object=arm

# Native sockets parented to fitted bones. Canonical runtime aliases are emitted
# again by the shared exporter; these authoring empties aid Blender editing.
socket_positions={'Head':('head',(0,0,1.60)),'LeftHand':('hand.L',(.467,-.011,.774)),'RightHand':('hand.R',(-.467,-.011,.774)),'Weapon':('hand.R',(-.467,-.011,.774))}
for name,(parent,position) in socket_positions.items():
    e=bpy.data.objects.new('Socket_'+name,None);bpy.context.collection.objects.link(e);e.empty_display_type='SPHERE';e.empty_display_size=.015;e.location=position
    matrix=e.matrix_world.copy();e.parent=arm;e.parent_type='BONE';e.parent_bone=parent;e.matrix_world=matrix;e['socket']=name

# Per-object unwrap, then explicit disjoint atlas rectangles. No mirrored UVs.
texsize=2048;minor=0;topology=[];exports=[]
for o in PARTS:
    active(o);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.022,area_weight=.15,correct_aspect=True,scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    if o==body:rect=(0,0,1024,1024)
    elif o==head:rect=(1024,0,1024,1024)
    else:rect=((minor%8)*256,1024+(minor//8)*256,256,256);minor+=1
    if rect[1]+rect[3]>texsize:raise ValueError('UV atlas capacity exceeded')
    x,y,w,h=rect
    # Blender bottom-origin coordinates; JSON uses glTF top-origin coordinates.
    for loop in o.data.uv_layers.active.data:
        u,v=loop.uv;loop.uv=((x+6+u*(w-12))/texsize,1-(y+6+(1-v)*(h-12))/texsize)
    bm=bmesh.new();bm.from_mesh(o.data)
    stat={'name':o.name,'role':o['basePart'],'vertices':len(bm.verts),'faces':len(bm.faces),'quads':sum(len(f.verts)==4 for f in bm.faces),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'degenerateFaces':sum(f.calc_area()<1e-12 for f in bm.faces),'uvAtlasRect':list(rect)}
    bm.free();topology.append(stat)
    if stat['nonManifoldEdges'] or stat['degenerateFaces']:raise RuntimeError('Invalid source topology '+str(stat))
    o.data.calc_loop_triangles();uv=o.data.uv_layers.active.data
    positions=[];normals=[];uvs=[];joint_rows=[];weight_rows=[];indices=[];morphs={n:[] for n in MORPHS};lookup={}
    for tri in o.data.loop_triangles:
        for li in tri.loops:
            loop=o.data.loops[li];vi=loop.vertex_index;u,v=uv[li].uv
            key=(vi,round(float(u),7),round(float(v),7))
            if key not in lookup:
                lookup[key]=len(positions);p=o.data.vertices[vi].co;n=o.data.vertices[vi].normal
                positions.append([float(p.x/1.6),float(p.z/1.6),float(-p.y/1.6)]);normals.append([float(n.x),float(n.z),float(-n.y)]);uvs.append([float(u),float(1-v)])
                ii,ww=weights(p,o['basePart']);joint_rows.append(ii);weight_rows.append(ww)
                for name in MORPHS:
                    d=o.data.shape_keys.key_blocks[name].data[vi].co-p;morphs[name].append([float(d.x/1.6),float(d.z/1.6),float(-d.y/1.6)])
            indices.append(lookup[key])
    exports.append({'id':o.name,'role':o['basePart'],'positions':positions,'normals':normals,'uv':uvs,'joints':joint_rows,'weights':weight_rows,'indices':indices,'morphTargets':morphs,'eyeCenter':list(o.get('eyeCenter',[])),'component':{'status':'inferred; original Blender DCC refinement'}})

# Give the editable source neutral materials before texture rebinding at review.
colors={'body':(.72,.67,.65,1),'head':(.94,.72,.70,1),'ear':(.94,.72,.70,1),'ear-inner':(.85,.51,.51,1),'eye-white':(.99,.99,1,1),'iris':(.03,.45,.8,1),'pupil':(.005,.012,.025,1),'highlight':(1,1,1,1),'lash':(.035,.022,.027,1),'lower-lid':(.62,.36,.39,1),'brow':(.17,.28,.28,1),'mouth':(.20,.04,.065,1),'lip':(.77,.45,.46,1)}
for role,color in colors.items():
    mat=bpy.data.materials.new('Base '+role);mat.diffuse_color=color;mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=color;bs.inputs['Roughness'].default_value=.72
    for o in PARTS:
        if o['basePart']==role:o.data.materials.append(mat)
export_bones=[{'name':b['name'],'parent':b['parent'],'position':[b['head'][0]/1.6,b['head'][2]/1.6,-b['head'][1]/1.6]} for b in bones]
record={'schema':'rinne.forge.blender-dcc/v1','round':ROUND,'blenderVersion':bpy.app.version_string,'modelHeight':1.6,'basis':'central three-view figure measurements; anatomical/artistic fitting is inferred','headProfile':PROFILE.tolist(),'headToBodyRatio':1.6/(1.6-.974),'parts':exports,'bones':export_bones,'sourceTopology':topology,'morphNames':MORPHS,'atlasSize':texsize,'externalGoldenRigVerified':False,'profile':'rinne.golden-base-boy.v1','productionReady':False}
(WORK/'dcc-meshes.json').write_text(json.dumps(record,separators=(',',':'),allow_nan=False))
(DCC/'topology.json').write_text(json.dumps({'blenderVersion':bpy.app.version_string,'round':ROUND,'objects':topology,'totalQuads':sum(s['quads'] for s in topology),'totalFaces':sum(s['faces'] for s in topology),'closedSourceMeshes':True,'fingerCountPerHand':5,'rigBones':len(bones),'externalGoldenRigVerified':False},indent=2))
bpy.context.scene['sourceReferenceSha256']='86b6d48c9f9818e3b31a571ef87937e8882b61cfcf5423ef12c24fd0d0f3efb1'
bpy.context.scene['reviewStatus']='DCC candidate, not approved'
active(body);bpy.ops.wm.save_as_mainfile(filepath=str(DCC/'golden-base-boy-v1-authoring.blend'),compress=True)
print('DCC_AUTHORING_COMPLETED',len(exports),'parts',sum(len(m['indices'])//3 for m in exports),'triangles')
