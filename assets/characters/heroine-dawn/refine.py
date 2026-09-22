"""Visual round 2: repair garment gaps and soften actual mesh curvature."""
import math
import bpy,bmesh,numpy as np
from mathutils import Vector,kdtree
from dcc_glb import read_glb

def refine(source,surface,extras):
    doc,binary,_=read_glb(source);node=next(n for n in doc['nodes'] if n.get('name')=='Rogue_Body');prim=doc['meshes'][node['mesh']]['primitives'][0]
    def read(index):
        a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];dt={5126:np.float32,5123:np.uint16,5121:np.uint8}[a['componentType']];width={'VEC3':3,'VEC4':4}[a['type']]
        return np.ndarray((a['count'],width),dtype=dt,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',np.dtype(dt).itemsize*width),np.dtype(dt).itemsize)).copy()
    src=read(prim['attributes']['POSITION']);js=read(prim['attributes']['JOINTS_0']);ws=read(prim['attributes']['WEIGHTS_0']);names=[doc['nodes'][i]['name'] for i in doc['skins'][0]['joints']];tree=kdtree.KDTree(len(src))
    for i,p in enumerate(src):tree.insert((float(p[0]),float(-p[2]),float(p[1])),i)
    tree.balance()
    def weights(p):
        result={};total=0
        for _,idx,d in tree.find_n(p,6):
            f=1/max(.0002,d*d);total+=f
            for j,w in zip(js[idx],ws[idx]):result[names[int(j)]]=result.get(names[int(j)],0)+float(w)*f
        return {k:v/total for k,v in result.items() if v/total>1e-5}
    def assign(ob):
        ob.vertex_groups.clear();rows=[weights(ob.matrix_world@v.co) for v in ob.data.vertices]
        for name in set(k for row in rows for k in row):ob.vertex_groups.new(name=name)
        for i,row in enumerate(rows):
            for k,w in row.items():ob.vertex_groups[k].add([i],w,'REPLACE')
    # Keep the actual source shorts/body core. Retopologize clothing over its
    # inspected torso envelope; transfer weights from the original body vertices.
    ob=bpy.data.objects['Rogue_Body'];me=ob.data;dead=[p.index for p in me.polygons if int(me.uv_layers.active.data[p.loop_start].uv.x*8)!=6]
    bm=bmesh.new();bm.from_mesh(me);bm.faces.ensure_lookup_table();bmesh.ops.delete(bm,geom=[bm.faces[i] for i in dead],context='FACES');bm.to_mesh(me);bm.free()
    rings=[(.405,.443,.307),(.455,.429,.309),(.56,.382,.30),(.70,.335,.288),(.82,.345,.307),(.97,.351,.296),(1.075,.326,.237),(1.15,.272,.163),(1.215,.177,.11)]
    N=32;vv=[];ff=[]
    for z,xr,yr in rings:
        for i in range(N):t=2*math.pi*i/N;vv.append((xr*math.sin(t),-yr*math.cos(t),z))
    for j in range(len(rings)-1):
        for i in range(N):a=j*N+i;b=j*N+(i+1)%N;ff.append((a,a+N,b+N,b))
    garment=surface('Heroine_VillagePinafore',vv,ff,2,[weights(p) for p in vv])
    for poly in garment.data.polygons:
        if sum(garment.data.vertices[i].co.z for i in poly.vertices)/len(poly.vertices)>1.095:
            for li in poly.loop_indices:garment.data.uv_layers.active.data[li].uv=(1.5/8,.15)
    sash=bpy.data.objects['Heroine_RoseSash']
    for v in sash.data.vertices:v.co.x*=.357/.332;v.co.y*=.315/.302;v.co.z+=.015
    assign(sash)
    for name in extras:
        if name.startswith('Heroine_BackWaistBow'):assign(bpy.data.objects[name])
    for name in ['Rogue_Head','Rogue_ArmLeft','Rogue_ArmRight','Rogue_LegLeft','Rogue_LegRight']:
        for poly in bpy.data.objects[name].data.polygons:poly.use_smooth=True
    hair=bpy.data.objects['Heroine_Hair_RoundedBob'];bpy.context.view_layer.objects.active=hair;mod=hair.modifiers.new('Rounded bob edge flow','SUBSURF');mod.levels=1;mod.render_levels=1;bpy.ops.object.modifier_apply(modifier=mod.name)
    def catmull(a,b,c,d,t):return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
    def soften(name,controls,widths):
        points=[];sizes=[]
        for j in range(len(controls)-1):
            ids=[max(0,j-1),j,j+1,min(len(controls)-1,j+2)]
            for step in range(5):
                t=step/5;points.append(catmull(*[Vector(controls[i]) for i in ids],t));sizes.append(max(.003,catmull(*[widths[i] for i in ids],t)))
        points.append(Vector(controls[-1]));sizes.append(widths[-1]);vv=[];ff=[];S=12
        for j,p in enumerate(points):
            tangent=points[min(len(points)-1,j+1)]-points[max(0,j-1)];tangent.y=0;tangent.normalize();side=Vector((tangent.z,0,-tangent.x))
            for k in range(S):t=2*math.pi*k/S;vv.append(tuple(p+side*(sizes[j]*math.cos(t))+Vector((0,.03*math.sin(t),0))))
        for j in range(len(points)-1):
            for k in range(S):a=j*S+k;b=j*S+(k+1)%S;ff.append((a,b,b+S,a+S))
        ff.extend([tuple(reversed(range(S))),tuple((len(points)-1)*S+k for k in range(S))]);ob=bpy.data.objects[name];material=ob.data.materials[0];me=bpy.data.meshes.new(name+'_Softened');me.from_pydata(vv,[],ff);me.update();me.materials.append(material);uv=me.uv_layers.new(name='UVMap')
        for poly in me.polygons:
            poly.use_smooth=True
            for li in poly.loop_indices:uv.data[li].uv=(.5/8,.15)
        ob.data=me;ob.vertex_groups.clear();g=ob.vertex_groups.new(name='head');g.add(list(range(len(vv))),1,'REPLACE')
    soften('Heroine_Hair_SweptFringe',[(.18,-.19,2.072),(.17,-.30,2.035),(.065,-.425,1.975),(-.13,-.469,1.867),(-.29,-.413,1.735),(-.403,-.300,1.55)],[.038,.12,.153,.140,.079,.004])
    soften('Heroine_Hair_TempleLock',[(.275,-.18,2.04),(.32,-.31,1.967),(.38,-.351,1.84),(.444,-.264,1.665),(.452,-.166,1.421)],[.033,.1,.109,.081,.004])
    for name in ['Heroine_Hair_RoundedBob','Heroine_Hair_SweptFringe','Heroine_Hair_TempleLock','Heroine_VillagePinafore']:
        ob=bpy.data.objects[name];bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free();ob.data.update()
    bpy.context.view_layer.update()
