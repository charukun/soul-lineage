"""Actual pinned KayKit mesh adaptation. Blender --background --python-exit-code 1.
The original face/limbs/rig remain traceable to CC0, with independently authored hair and clothing surfaces.
"""
import argparse,hashlib,json,math,sys
from pathlib import Path
import bpy,bmesh
import numpy as np
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from dcc_glb import export_edited,BODY_NAMES,EXPECTED_SHA256
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--out',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);source=Path(a.source).resolve();out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==EXPECTED_SHA256
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source))
rig=bpy.data.objects['Rig'];rig.data.pose_position='REST'
for ob in bpy.data.objects:
    if ob.animation_data:
        ob.animation_data.action=None
        for tr in ob.animation_data.nla_tracks:tr.mute=True
bpy.context.view_layer.update()
image=bpy.data.images['rogue_texture'].copy();image.name='HeroineDawnPalette'
w,h=image.size;pixels=np.asarray(image.pixels[:],dtype=np.float32).reshape(h,w,4)
colors=[(.275,.135,.080),(.925,.875,.745),(.29,.54,.69),(.69,.29,.38),(.29,.18,.12),(.94,.77,.61),(.70,.78,.82),(.82,.63,.30)]
for col,c in enumerate(colors):
    y,x=np.mgrid[0:h//4,0:w//8];shade=.91+.09*y/(h//4-1)
    pixels[0:h//4,col*w//8:(col+1)*w//8,:3]=np.asarray(c)[None,None,:]*shade[:,:,None];pixels[0:h//4,col*w//8:(col+1)*w//8,3]=1
image.pixels[:]=pixels.reshape(-1);image.filepath_raw=str(out/'HeroineDawnPalette.png');image.file_format='PNG';image.save();image.pack()
mat=bpy.data.materials.new('HeroineDawn_SoftClothAndHair');mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.82
tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
def tile(uv):return(min(7,int(uv.x*8)),min(3,int((1-uv.y)*4)))
def set_palette(me,poly,col):
    for li in poly.loop_indices:me.uv_layers.active.data[li].uv=((col+.5)/8,.15)
def remove_faces(ob,indices):
    bm=bmesh.new();bm.from_mesh(ob.data);bm.faces.ensure_lookup_table();bmesh.ops.delete(bm,geom=[bm.faces[i] for i in indices],context='FACES');bm.to_mesh(ob.data);bm.free();ob.data.update()
def use_mat(ob):ob.data.materials.clear();ob.data.materials.append(mat)
removed={};head=bpy.data.objects['Rogue_Head'];me=head.data;dead=[];brows=set();eyes=set()
for poly in me.polygons:
    t=tile(me.uv_layers.active.data[poly.loop_start].uv);co=[head.matrix_world@me.vertices[i].co for i in poly.vertices]
    brow=t==(1,0) and all(1.675<v.z<1.79 and abs(v.x)<.32 and v.y<-.28 for v in co)
    if t==(1,0) and not brow or t==(3,0):dead.append(poly.index)
    if brow:brows.update(poly.vertices);set_palette(me,poly,0)
    if t==(2,0):eyes.update(poly.vertices)
for i in brows:
    v=me.vertices[i];v.co.z=1.732+(v.co.z-1.732)*.50+.012
for i in eyes:
    v=me.vertices[i];v.co.z=1.606+(v.co.z-1.606)*1.07
remove_faces(head,dead);removed['headHairAndEarringFaces']=len(dead);use_mat(head)
body=bpy.data.objects['Rogue_Body'];me=body.data;dead=[];main_ids=set()
for poly in me.polygons:
    t=tile(me.uv_layers.active.data[poly.loop_start].uv)
    if t in[(1,1),(3,0),(5,0),(6,0)]:dead.append(poly.index);continue
    if t==(0,1):set_palette(me,poly,2);main_ids.update(poly.vertices)
    elif t==(7,1):set_palette(me,poly,6)
for i in main_ids:
    v=me.vertices[i];z=v.co.z;factor=1-.10*math.exp(-((z-.73)/.19)**2)+.22*max(0,(.67-z)/.25);v.co.x*=factor;v.co.y*=factor
remove_faces(body,dead);removed['scarfBeltPouchFaces']=len(dead);use_mat(body)
for name in['Rogue_ArmLeft','Rogue_ArmRight']:
    ob=bpy.data.objects[name];me=ob.data;puff=set()
    for poly in me.polygons:
        t=tile(me.uv_layers.active.data[poly.loop_start].uv)
        if t==(5,2):
            for li in poly.loop_indices:me.uv_layers.active.data[li].uv=(.065,.875)
        elif t==(1,1):set_palette(me,poly,1)
        else:set_palette(me,poly,1);puff.update(poly.vertices)
    for i in puff:
        v=me.vertices[i];ax=abs(v.co.x);f=1+.30*math.exp(-((ax-.33)/.17)**2);v.co.y*=f;v.co.z=1.10676+(v.co.z-1.10676)*f
    use_mat(ob)
for name in['Rogue_LegLeft','Rogue_LegRight']:
    ob=bpy.data.objects[name]
    for poly in ob.data.polygons:
        t=tile(ob.data.uv_layers.active.data[poly.loop_start].uv);set_palette(ob.data,poly,4 if t==(3,2) else 1 if t==(0,0) else 6)
    use_mat(ob)
extras=[]
def surface(name,vertices,faces,col,weights='head',smooth=True):
    me=bpy.data.meshes.new(name);me.from_pydata(vertices,[],faces);me.update();ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob);ob.data.materials.append(mat);uv=me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        poly.use_smooth=smooth
        for li in poly.loop_indices:uv.data[li].uv=((col+.5)/8,.15)
    if isinstance(weights,str):weights=[{weights:1.0} for _ in vertices]
    for name_ in set(k for row in weights for k in row):ob.vertex_groups.new(name=name_)
    for i,row in enumerate(weights):
        for key,value in row.items():
            if value>0:ob.vertex_groups[key].add([i],value,'REPLACE')
    mod=ob.modifiers.new('Preserved KayKit skin','ARMATURE');mod.object=rig;extras.append(name);return ob
verts=[];faces=[];N=40
levels=[(.025,2.12),(.37,2.09),(.70,2.01),(.92,1.87),(1.02,1.68),(.98,1.49),(.87,1.36)]
for j,(radius,z) in enumerate(levels):
    for i in range(N):
        t=2*math.pi*i/N;front=max(0,(math.cos(t)-.33)/.67)**.85;lift=[0,0,0,0,.145,.295,.435][j]*front;groove=1+.012*math.cos(10*t+.5)*max(0,(j-2)/4)
        verts.append((.535*radius*math.sin(t)*groove,.022-.466*radius*math.cos(t)*groove,z+lift+(.011*math.cos(10*t) if j==6 else 0)))
for j in range(len(levels)-1):
    for i in range(N):a0=j*N+i;b0=j*N+(i+1)%N;faces.append((a0,b0,b0+N,a0+N))
faces.append(tuple(reversed(range(N))));surface('Heroine_Hair_RoundedBob',verts,faces,0)
def lock(name,path,widths,col=0,thickness=.035,weight='head'):
    vv=[];ff=[];S=8
    for j,p0 in enumerate(path):
        p0=Vector(p0);prev=Vector(path[max(0,j-1)]);nxt=Vector(path[min(len(path)-1,j+1)]);tangent=nxt-prev;tangent.y=0;tangent.normalize();across=Vector((tangent.z,0,-tangent.x))
        for k in range(S):
            angle=2*math.pi*k/S;q=p0+across*(widths[j]*math.cos(angle))+Vector((0,thickness*math.sin(angle),0));vv.append(tuple(q))
    for j in range(len(path)-1):
        for k in range(S):a0=j*S+k;b0=j*S+(k+1)%S;ff.append((a0,b0,b0+S,a0+S))
    ff.extend([tuple(reversed(range(S))),tuple((len(path)-1)*S+k for k in range(S))]);return surface(name,vv,ff,col,weight)
lock('Heroine_Hair_SweptFringe',[(.19,-.282,2.045),(.08,-.405,1.982),(-.10,-.471,1.883),(-.285,-.420,1.756),(-.402,-.303,1.55)],[.12,.17,.155,.100,.004])
lock('Heroine_Hair_TempleLock',[(.29,-.287,2.003),(.379,-.353,1.858),(.45,-.276,1.69),(.458,-.175,1.405)],[.10,.125,.103,.003])
for sign in[-1,1]:
    v=[(sign*.012,-.162,1.245),(sign*.17,-.126,1.217),(sign*.25,-.177,1.138),(sign*.19,-.274,1.064),(sign*.095,-.30,1.096),(sign*.02,-.259,1.169)];v.append(tuple(sum(p[k] for p in v)/len(v) for k in range(3)))
    ob=surface('Heroine_Collar_'+('L' if sign>0 else 'R'),v,[(6,i,(i+1)%6) for i in range(6)],1,'chest');solid=ob.modifiers.new('Sewn collar thickness','SOLIDIFY');solid.thickness=.014;bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=solid.name)
vv=[];ff=[]
for z in[.655,.718]:
    for i in range(32):t=2*math.pi*i/32;vv.append((.332*math.sin(t),-.302*math.cos(t),z))
for i in range(32):ff.append((i,(i+1)%32,(i+1)%32+32,i+32))
surface('Heroine_RoseSash',vv,ff,3,'spine')
def bow(name,center,scale,weight='head'):
    cx,cy,cz=center
    for sign in[-1,1]:
        coords=[(0,0,0),(.30,-.01,.20),(.48,0,.25),(.54,.01,.07),(.46,-.01,-.18),(.23,-.026,-.12)];v=[(cx+sign*x*scale,cy+y*scale,cz+z*scale) for x,y,z in coords];v.append((cx+sign*.31*scale,cy-.07*scale,cz+.03*scale))
        ob=surface(name+('_L' if sign>0 else '_R'),v,[(6,i,(i+1)%6) for i in range(6)],3,weight);mod=ob.modifiers.new('Cloth thickness','SOLIDIFY');mod.thickness=.009;bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=mod.name)
    lock(name+'_knot',[(cx,cy,cz+.042*scale),(cx,cy-.018,cz),(cx,cy,cz-.042*scale)],[.063*scale,.077*scale,.063*scale],3,.018,weight)
bow('Heroine_Hair_RoseBow',(.462,-.20,1.935),.37);bow('Heroine_BackWaistBow',(0,.313,.71),.32,'spine')
for ob in bpy.data.objects:
    if ob.type=='MESH':
        ob.hide_render=ob.name not in list(BODY_NAMES)+extras
        if ob.name in bpy.context.view_layer.objects:ob.hide_set(ob.hide_render)
bpy.context.view_layer.update()
audit=export_edited(source,out/'HeroineDawn.glb',out/'HeroineDawnPalette.png',extras);audit.update(removedFaces=removed,authoringTool=bpy.app.version_string,round=1,design='rounded-chin-bob/swept-fringe/ivory-collar/puff-sleeves/blue-village-tunic/rose-bows/no-cape-no-utility-belt',sourceRig='Rig_Medium')
(out/'inspection.json').write_text(json.dumps(audit,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(out/'HeroineDawn.blend'),compress=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=48;scene.cycles.use_denoising=False;scene.render.resolution_x=768;scene.render.resolution_y=960;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
scene.world=bpy.data.worlds.new('Neutral World');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.27,.31,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.8;scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
height=2.187;center=Vector((.0079,.01155,height/2))
def light(name,location,power,size):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=location;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
light('Key',center+Vector((height*1.5,-height*2,height*2)),750,height*1.5);light('Fill',center+Vector((-height*2,-height,height)),400,height*2);light('Back',center+Vector((height,height*2,height*2)),600,height*2)
camdata=bpy.data.cameras.new('ReviewCamera');cam=bpy.data.objects.new('ReviewCamera',camdata);scene.collection.objects.link(cam);scene.camera=cam;camdata.type='ORTHO'
for name,deg in[('front',0),('three-quarter',35),('side',90),('back',180),('face',0)]:
    ang=math.radians(deg);target=center.copy();camdata.ortho_scale=height*1.3
    if name=='face':target.z=1.72;camdata.ortho_scale=1.18
    cam.location=target+Vector((math.sin(ang)*height*3,-math.cos(ang)*height*3,height*.04));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
print('HEROINE_DCC_CANDIDATE',json.dumps(audit))
