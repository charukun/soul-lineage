"""Repair the reviewed heroine's real open surfaces without replacing her identity.
Run against the pinned editable HeroineDawn.blend. No rig/motion re-export.
"""
import argparse, hashlib, json, math, struct, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).resolve().parent))
from dcc_glb import BODY_NAMES, EXPECTED_SHA256, export_edited
BASELINE = '777f0c4f7f910edf85ab66011fddf961b7144a4a129212cf8a0b5a1b73937678'
p = argparse.ArgumentParser(); p.add_argument('--source', required=True); p.add_argument('--out', required=True)
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:]); out = Path(a.out).resolve(); out.mkdir(parents=True, exist_ok=True)
provenance = json.loads(Path('apps/review/public/library/provenance/heroine-dawn-v1.json').read_text())
assert provenance['sha256'] == BASELINE
assert hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest() == provenance['dccSourceSha256']
assert hashlib.sha256(Path(a.source).read_bytes()).hexdigest() == EXPECTED_SHA256
rig = bpy.data.objects['Rig']; rig.data.pose_position = 'REST'
for ob in bpy.data.objects:
    if ob.animation_data:
        ob.animation_data.action = None
        for track in ob.animation_data.nla_tracks: track.mute = True
bpy.context.view_layer.update()

def topology(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
    result = {'vertices': len(ob.data.vertices), 'polygons': len(ob.data.polygons), 'boundaryEdges': sum(e.is_boundary for e in bm.edges), 'nonManifoldEdges': sum(not e.is_manifold and not e.is_boundary for e in bm.edges)}
    bm.free(); return result

repairs = []
# An inward shell preserves the accepted outside silhouette and UVs. Its return
# face and sewn rim are geometry, not DoubleSide pretending a sheet has volume.
for name, thickness in [('Heroine_Hair_RoundedBob', .018), ('Heroine_VillagePinafore', .012), ('Heroine_RoseSash', .008)]:
    ob = bpy.data.objects[name]; before = topology(ob); original = [v.co.copy() for v in ob.data.vertices]; face_count = len(ob.data.polygons)
    assert before['boundaryEdges'] > 0
    bpy.context.view_layer.objects.active = ob
    modifier = ob.modifiers.new('Opaque inward shell and closed rim', 'SOLIDIFY')
    modifier.thickness = thickness; modifier.offset = -1; modifier.use_rim = True; modifier.use_even_offset = True; modifier.use_quality_normals = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for poly in ob.data.polygons:
        if poly.index >= face_count * 2: poly.use_smooth = False
    ob.data.update(); after = topology(ob)
    actual = {tuple(round(float(x), 6) for x in v.co) for v in ob.data.vertices}
    preserved = all(tuple(round(float(x), 6) for x in v) in actual for v in original)
    assert preserved and after['boundaryEdges'] == 0 and after['nonManifoldEdges'] == 0, name
    repairs.append({'mesh': name, 'operation': 'inward-shell-and-sewn-rim', 'thickness': thickness, 'outerPositionsPreserved': preserved, 'before': before, 'after': after})

# Imported cuffs contain two unjoined concentric boundary loops. Bridge only
# those loops, preserving the hand opening and original weighted surfaces.
for name in ['Rogue_ArmLeft', 'Rogue_ArmRight']:
    ob = bpy.data.objects[name]; before = topology(ob); bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
    edges = [e for e in bm.edges if e.is_boundary and all(abs(abs(v.co.x) - .59928) < .0003 for v in e.verts)]
    assert len(edges) == 28, (name, len(edges))
    faces = bmesh.ops.bridge_loops(bm, edges=edges)['faces']; uv = bm.loops.layers.uv.active
    for face in faces:
        face.smooth = False
        for loop in face.loops: loop[uv].uv = (1.5 / 8, .15)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(ob.data); bm.free(); ob.data.update()
    after = topology(ob); assert after['boundaryEdges'] == 0, (name, after)
    repairs.append({'mesh': name, 'operation': 'bridge-existing-cuff-lips', 'before': before, 'after': after})

# Close the original shorts' open waist beneath the skirt. The skirt itself
# remains a garment opening with an actual lining, not a flat opaque plug.
ob = bpy.data.objects['Rogue_Body']; before = topology(ob); bm = bmesh.new(); bm.from_mesh(ob.data)
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
edges = [e for e in bm.edges if e.is_boundary]; assert len(edges) == 22
faces = bmesh.ops.holes_fill(bm, edges=edges, sides=0)['faces']; uv = bm.loops.layers.uv.active
for face in faces:
    for loop in face.loops: loop[uv].uv = (6.5 / 8, .15)
bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(ob.data); bm.free(); ob.data.update()
after = topology(ob); assert after['boundaryEdges'] == 0
repairs.append({'mesh': ob.name, 'operation': 'close-existing-inner-waist', 'before': before, 'after': after})

# Keep the original face mesh completely untouched. Rebuilding its vertex fans
# quantizes artist-authored split normals and can erase the smile. The missing
# scalp is closed by a skin seam surface with identical boundary positions and
# head weights, not by filling eye/brow/nose/ear overlays or replacing the face.
head = bpy.data.objects['Rogue_Head']; before = topology(head); head.data.calc_normals_split()
facial_corners = [(head.data.vertices[loop.vertex_index].co.copy(), head.data.uv_layers.active.data[loop.index].uv.copy(), loop.normal.copy()) for loop in head.data.loops]
bm = bmesh.new(); bm.from_mesh(head.data); bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
unseen = set(e for e in bm.edges if e.is_boundary); components = []
while unseen:
    seed = unseen.pop(); component = {seed}; todo = list(seed.verts)
    while todo:
        vertex = todo.pop()
        for edge in vertex.link_edges:
            if edge in unseen: unseen.remove(edge); component.add(edge); todo.extend(edge.verts)
    components.append(component)
candidates = [c for c in components if len(c) == 24 and max(v.co.z for e in c for v in e.verts) > 1.86]
assert len(candidates) == 1
boundary = sorted({v for e in candidates[0] for v in e.verts}, key=lambda v: tuple(v.co))
index = {v: i for i, v in enumerate(boundary)}; points = [tuple(v.co) for v in boundary] + [(.008, .012, 1.955)]
faces = []
for edge in sorted(candidates[0], key=lambda e: tuple(sorted(index[v] for v in e.verts))):
    loop = edge.link_loops[0]; faces.append((index[loop.link_loop_next.vert], index[loop.vert], len(boundary)))
bm.free()
mesh = bpy.data.meshes.new('Heroine_ScalpClosure'); mesh.from_pydata(points, [], faces); mesh.update(); mesh.materials.append(head.data.materials[0])
closure = bpy.data.objects.new('Heroine_ScalpClosure', mesh); bpy.context.scene.collection.objects.link(closure); closure.matrix_world = head.matrix_world.copy()
uv = mesh.uv_layers.new(name='UVMap')
for face in mesh.polygons:
    face.use_smooth = True
    for li in face.loop_indices: uv.data[li].uv = (.065, .875)
group = closure.vertex_groups.new(name='head'); group.add(list(range(len(points))), 1, 'REPLACE')
modifier = closure.modifiers.new('Preserved KayKit scalp skin', 'ARMATURE'); modifier.object = rig
# Geometric topology is measured across the joined skin domain, independently
# of the split mesh boundary used to preserve original shading data.
bm = bmesh.new(); bm.from_mesh(head.data); bm.from_mesh(mesh); bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
after = {'domain': ['Rogue_Head', 'Heroine_ScalpClosure'], 'vertices': len(bm.verts), 'polygons': len(bm.faces), 'boundaryEdges': sum(e.is_boundary for e in bm.edges), 'nonManifoldEdges': sum(not e.is_manifold and not e.is_boundary for e in bm.edges)}
bm.free(); assert after['boundaryEdges'] == before['boundaryEdges'] - 24
head.data.calc_normals_split()
for index, (position, texcoord, normal) in enumerate(facial_corners):
    loop = head.data.loops[index]
    assert (head.data.vertices[loop.vertex_index].co - position).length == 0
    assert (head.data.uv_layers.active.data[index].uv - texcoord).length == 0
normal_delta = max((head.data.loops[i].normal - row[2]).length for i, row in enumerate(facial_corners))
assert normal_delta < .002
face_preservation = {'originalCorners': len(facial_corners), 'positionsAndUvsUnchanged': True, 'maxCornerNormalDelta': normal_delta, 'normalTolerance': .002, 'method': 'original head mesh and split normals untouched; separate geometric scalp closure', 'features': ['smile', 'eyes', 'eyebrows', 'nose', 'ears']}
repairs.append({'mesh': head.name, 'operation': 'close-only-missing-scalp-under-bob', 'closureMesh': closure.name, 'preserved': 'face, smile, eyes, brows, nose, ears and original split normals', 'before': before, 'after': after})

# An inset continuation at the collar joins the otherwise point-contact chin
# and torso during head tilt. Derived from the existing garment neck contour.
base = bpy.data.objects['Heroine_VillagePinafore']; mat = base.data.materials[0]; vertices = []; faces = []; n = 16
for z, scale in [(1.17, .70), (1.35, .78)]:
    for i in range(n):
        t = 2 * math.pi * i / n; vertices.append((.177 * scale * math.sin(t), -.11 * scale * math.cos(t), z))
for i in range(n): faces.append((i, (i + 1) % n, (i + 1) % n + n, i + n))
faces.extend([tuple(reversed(range(n))), tuple(range(n, 2 * n))])
mesh = bpy.data.meshes.new('Heroine_NeckInset'); mesh.from_pydata(vertices, [], faces); mesh.update(); mesh.materials.append(mat)
ob = bpy.data.objects.new('Heroine_NeckInset', mesh); bpy.context.scene.collection.objects.link(ob); uv = mesh.uv_layers.new(name='UVMap')
for face in mesh.polygons:
    face.use_smooth = len(face.vertices) == 4
    for li in face.loop_indices: uv.data[li].uv = (.065, .875)
group = ob.vertex_groups.new(name='chest'); group.add(list(range(n)), 1, 'REPLACE'); group.add(list(range(n, n * 2)), .25, 'REPLACE')
group = ob.vertex_groups.new(name='head'); group.add(list(range(n, n * 2)), .75, 'REPLACE')
modifier = ob.modifiers.new('Preserved KayKit skin', 'ARMATURE'); modifier.object = rig
bm = bmesh.new(); bm.from_mesh(mesh); bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(mesh); bm.free()
assert topology(ob)['boundaryEdges'] == 0
repairs.append({'mesh': ob.name, 'operation': 'overlapping-weighted-neck-seam', 'after': topology(ob)})

image = bpy.data.images['HeroineDawnPalette']; image.filepath_raw = str(out / 'HeroineDawnPalette.png'); image.file_format = 'PNG'; image.save(); image.pack()
for material in bpy.data.materials:
    if material.use_nodes:
        bsdf = material.node_tree.nodes.get('Principled BSDF')
        if bsdf:
            for link in list(bsdf.inputs['Alpha'].links): material.node_tree.links.remove(link)
            bsdf.inputs['Alpha'].default_value = 1
    if hasattr(material, 'blend_method'): material.blend_method = 'OPAQUE'
extras = [o.name for o in bpy.context.scene.objects if o.type == 'MESH' and o.name.startswith('Heroine_')]
for ob in bpy.data.objects:
    if ob.type == 'MESH':
        ob.hide_render = ob.name not in list(BODY_NAMES) + extras
        if ob.name in bpy.context.view_layer.objects: ob.hide_set(ob.hide_render)
bpy.context.view_layer.update()
audit = export_edited(a.source, out / 'HeroineDawn.glb', out / 'HeroineDawnPalette.png', extras)
# OPAQUE is explicit in the delivered asset; no renderer/CSS workaround.
body = (out / 'HeroineDawn.glb').read_bytes(); size = struct.unpack_from('<I', body, 12)[0]; doc = json.loads(body[20:20 + size]); binary = body[28 + size:]
for material in doc['materials']:
    material['alphaMode'] = 'OPAQUE'; material.pop('alphaCutoff', None)
    material['pbrMetallicRoughness']['baseColorFactor'] = [1, 1, 1, 1]
text = json.dumps(doc, separators=(',', ':')).encode(); text += b' ' * (-len(text) % 4)
body = struct.pack('<III', 0x46546c67, 2, 28 + len(text) + len(binary)) + struct.pack('<II', len(text), 0x4e4f534a) + text + struct.pack('<II', len(binary), 0x004e4942) + binary
(out / 'HeroineDawn.glb').write_bytes(body)
audit.update(bytes=len(body), sha256=hashlib.sha256(body).hexdigest(), gitBlobSha=hashlib.sha1(f'blob {len(body)}\0'.encode() + body).hexdigest(), baselineSha256=BASELINE, authoringTool=bpy.app.version_string, sourceRig='Rig_Medium', repairs=repairs, faceSurfacePreservation=face_preservation, opacity='explicit OPAQUE; alpha=1; retained two-sided surface shading with real closed thickness', design='preserved Heroine Dawn smile, face, rounded bob, swept fringe, ivory sleeves/collar, blue pinafore and rose bows')
assert audit['triangles'] < 10000, audit['triangles']
(out / 'inspection.json').write_text(json.dumps(audit, indent=2)); bpy.ops.wm.save_as_mainfile(filepath=str(out / 'HeroineDawn.blend'), compress=True)
print('HEROINE_OPACITY_REPAIR', json.dumps(audit))
