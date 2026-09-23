"""Refine the pinned-generated Scout hair rim, before rig/mesh freeze.

Uses the repository's headless Blender script/audit route. It imports the
actual upstream mesh buffers; no replacement head/body/hair is generated.
"""
import argparse,hashlib,json,math,sys
from pathlib import Path
import bpy,bmesh
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree

def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--workspace',required=True)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);w=Path(args.workspace).resolve()
    state=json.loads((w/'.img2threejs/state.json').read_text())
    if state['status']!='active':raise RuntimeError('No DCC reconstruction past an upstream hard stop')
    spec=json.loads((w/'object-sculpt-spec.json').read_text())
    if spec['sculptPipeline']['currentPass']!='material-pass':raise RuntimeError('This correction belongs to the rejected material pass')
    payload=w/'review/material-r7-before-dcc/mesh-buffers.json';rows=json.loads(payload.read_text())
    if hashlib.sha256(payload.read_bytes()).hexdigest()!='e810b19a156863ff728cf262504c94a9cc9289a0591d04b2008136714cb91e7f':raise RuntimeError('Expected the actual pre-DCC upstream payload')
    source=json.loads((w/'img2threejs/evidence/landmarks.json').read_text())
    scale=source['heightMetres']/(source['feetRow']-source['crownRow'])
    rim_y=(source['feetRow']-source['views']['front']['face']['foreheadRow'])*scale
    names={n['id']:n['name'] for n in spec['componentTree']}
    texture_rows={r['mesh']:r for r in json.loads((w/'review/material-pass/projection-bake.json').read_text())['outputs']}
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    objects={};matrices={}
    to_blender=lambda p:Vector((p[0],-p[2],p[1]))
    to_three=lambda p:Vector((p.x,p.z,-p.y))
    for row in rows:
        values=row['matrixWorld'];m=Matrix([[values[c*4+r]for c in range(4)]for r in range(4)])
        matrices[row['name']]=m
        vertices=[to_blender(m@Vector(row['position'][i:i+3]))for i in range(0,len(row['position']),3)]
        indices=row['index'] or list(range(len(vertices)));faces=[indices[i:i+3]for i in range(0,len(indices),3)]
        mesh=bpy.data.meshes.new(row['name']);mesh.from_pydata(vertices,[],faces);mesh.update()
        uv=mesh.uv_layers.new(name='SourceProjection')
        for loop in mesh.loops:uv.data[loop.index].uv=row['uv'][loop.vertex_index*2:loop.vertex_index*2+2]
        obj=bpy.data.objects.new(row['name'],mesh);bpy.context.collection.objects.link(obj);objects[row['name']]=obj
        for poly in mesh.polygons:poly.use_smooth=True
        mat=bpy.data.materials.new(row['name']);mat.use_nodes=True;bsdf=mat.node_tree.nodes.get('Principled BSDF')
        tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(w/texture_rows[row['name']]['files']['albedo']));mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color']);bsdf.inputs['Roughness'].default_value=.85;obj.data.materials.append(mat)
    hair=objects[names['hair']];head=objects[names['head']]
    bpy.ops.object.select_all(action='DESELECT');hair.select_set(True);bpy.context.view_layer.objects.active=hair
    # Projection chart splits are transport vertices. Weld only coincident
    # hair positions for Blender's connected smoothing, before any rig freeze.
    bm=bmesh.new();bm.from_mesh(hair.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-8);bm.to_mesh(hair.data);bm.free();hair.data.update()
    before=[v.co.copy()for v in hair.data.vertices];tree=BVHTree.FromObject(head,bpy.context.evaluated_depsgraph_get())
    group=hair.vertex_groups.new(name='ObservedForeheadRim');selected=0;max_pull=0
    for v in hair.data.vertices:
        p=to_three(v.co);band=max(0.,1.-abs(p.y-rim_y)/(6*scale))
        front=max(0.,min(1.,p.z/(6*scale)))
        weight=.6*band*front
        if weight<=0:continue
        nearest=tree.find_nearest(v.co)
        if nearest[0] is None:raise RuntimeError('Head surface lookup failed')
        point,normal,_,distance=nearest
        if distance>8*scale:continue
        target=point+normal*(.3*scale);delta=(target-v.co)*weight
        if delta.length>6*scale:delta*=6*scale/delta.length
        v.co+=delta;max_pull=max(max_pull,delta.length);group.add([v.index],weight,'REPLACE');selected+=1
    if not selected:raise RuntimeError('No actual upstream hair vertices intersected the observed rim band')
    modifier=hair.modifiers.new('Reference rim relaxation','SMOOTH');modifier.vertex_group=group.name;modifier.factor=.35;modifier.iterations=1
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    hair.data.update()
    displacement=max((v.co-before[i]).length for i,v in enumerate(hair.data.vertices))
    if displacement>8*scale:raise RuntimeError('DCC displacement exceeds declared band budget')
    # The closed SDF cap has an inner and outer surface. Projection toward the
    # head must not leave overlapping folds; voxel cleanup is a real Blender
    # mesh-repair operation on the generated hair, before the rig freeze.
    pulled_tree=BVHTree.FromObject(hair,bpy.context.evaluated_depsgraph_get())
    before_remesh_vertices=len(hair.data.vertices)
    remesh=hair.modifiers.new('Resolve collapsed cap sheets before freeze','REMESH')
    remesh.mode='VOXEL';remesh.voxel_size=.65*scale;remesh.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    hair.data.update();hair.data.calc_loop_triangles()
    remesh_distance=max(pulled_tree.find_nearest(v.co)[3] for v in hair.data.vertices)
    if remesh_distance>2*scale:raise RuntimeError('Voxel cleanup moved hair beyond its two-source-pixel repair budget')
    inverse=matrices[hair.name].inverted();normal_transform=matrices[hair.name].to_3x3().transposed()
    positions=[];normals=[]
    for vertex in hair.data.vertices:
        positions.extend(inverse@to_three(vertex.co));normals.extend((normal_transform@to_three(vertex.normal)).normalized())
    index=[i for tri in hair.data.loop_triangles for i in tri.vertices]
    out=w/'build/dcc';out.mkdir(parents=True,exist_ok=True)
    component=next(n for n in spec['componentTree'] if n['id']=='hair')
    geometry={'schema':'rinne.dcc-refined-mesh/v1','componentId':'hair','name':hair.name,'position':positions,'normal':normals,'index':index,'sourceFactorySha256':digest(w/'build/material-pass.ts'),'sourceMeshPayloadSha256':digest(payload),'sourceGeometryDescriptor':component['geometryDescriptor'],'sourceTransform':component['transform']}
    target=out/'refined-hair.json';target.write_text(json.dumps(geometry,separators=(',',':'))+'\n')
    bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'scout-refinement.blend'))
    report={'sourceFactorySha256':geometry['sourceFactorySha256'],'sourceMeshPayloadSha256':digest(payload),'outputSha256':digest(target),'blenderVersion':bpy.app.version_string,'observation':'Front forehead row and actual r7 helmet rim','observedForeheadRow':source['views']['front']['face']['foreheadRow'],'inferredBrushBandPixels':6,'inferredClearancePixels':.3,'selectedVertices':selected,'maxPullFraction':.6,'voxelSizeMetres':.65*scale,'maxRemeshSurfaceDistanceMetres':remesh_distance,'preRemeshVertices':before_remesh_vertices,'postRemeshVertices':len(hair.data.vertices),'topologyChangedBeforeFreeze':True,'maxPullMetres':max_pull,'maxTotalDisplacementMetres':displacement,'sourcePixelsChanged':False,'otherGeometryChanged':False,'rigFrozen':False,'visualApproval':'pending browser reprojection and FSB/oblique/scalp comparison'}
    (out/'refinement.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
if __name__=='__main__':main()
