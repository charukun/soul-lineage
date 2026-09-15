#!/usr/bin/env python3
import bpy, json, math, os, sys


def cli_args():
    raw = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = {'input': '', 'output': '', 'audit': '', 'mode': 'static', 'lod1': .55, 'lod2': .25}
    i = 0
    while i < len(raw):
        key = raw[i].lstrip('-').replace('-', '_')
        if key in out and i + 1 < len(raw):
            value = raw[i + 1]
            if key in ('lod1', 'lod2'): value = float(value)
            out[key] = value; i += 2
        else:
            i += 1
    if out['mode'] not in ('static', 'character'): raise RuntimeError('mode must be static or character')
    if not (0.05 <= out['lod2'] < out['lod1'] < 1): raise RuntimeError('expected 0.05 <= lod2 < lod1 < 1')
    if not out['output'] or not out['audit']: raise RuntimeError('--output and --audit are required')
    return out


def import_source(path):
    if not path: return
    path = os.path.abspath(path)
    ext = os.path.splitext(path)[1].lower()
    if ext == '.blend':
        if os.path.abspath(bpy.data.filepath or '') != path: bpy.ops.wm.open_mainfile(filepath=path)
    elif ext in ('.glb', '.gltf'):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=path)
    else:
        raise RuntimeError(f'unsupported DCC source: {ext}')


def triangles(obj):
    return sum(max(0, len(poly.vertices) - 2) for poly in obj.data.polygons)


def hull(points):
    pts = sorted(set((round(a, 8), round(b, 8)) for a, b in points))
    if len(pts) <= 2: return pts
    def cross(o, a, b): return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lo = []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    hi = []
    for p in reversed(pts):
        while len(hi) >= 2 and cross(hi[-2], hi[-1], p) <= 0: hi.pop()
        hi.append(p)
    return lo[:-1] + hi[:-1]


def polygon_area(poly):
    if len(poly) < 3: return 0.0
    return abs(sum(poly[i][0]*poly[(i+1)%len(poly)][1]-poly[(i+1)%len(poly)][0]*poly[i][1] for i in range(len(poly))) * .5)


def silhouette(obj):
    pts = [(v.co.x, v.co.y, v.co.z) for v in obj.data.vertices]
    if not pts: return {'front': 0, 'side': 0, 'diag': 0, 'width': 0, 'depth': 0, 'height': 0}
    xs=[p[0] for p in pts]; ys=[p[1] for p in pts]; zs=[p[2] for p in pts]
    diag=[((p[0]+p[2])*math.sqrt(.5), p[1]) for p in pts]
    return {
        'front': polygon_area(hull([(p[0],p[1]) for p in pts])),
        'side': polygon_area(hull([(p[2],p[1]) for p in pts])),
        'diag': polygon_area(hull(diag)),
        'width': max(xs)-min(xs), 'depth': max(zs)-min(zs), 'height': max(ys)-min(ys),
    }


def relative_delta(a, b):
    return abs(b-a) / max(abs(a), 1e-8)


def quality_check(before, after, level):
    area_limit = .18 if level == 1 else .30
    extent_limit = .08 if level == 1 else .15
    errors=[]
    for key in ('front','side','diag'):
        if relative_delta(before[key], after[key]) > area_limit: errors.append(f'{key} silhouette drift')
    for key in ('width','depth','height'):
        if relative_delta(before[key], after[key]) > extent_limit: errors.append(f'{key} extent drift')
    return errors


def activate(obj):
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj


def decimate(obj, ratio):
    activate(obj)
    modifier=obj.modifiers.new(name='Soul_LOD_Decimate', type='DECIMATE'); modifier.ratio=ratio; modifier.use_collapse_triangulate=True
    armature_index=next((i for i,m in enumerate(obj.modifiers) if m.type=='ARMATURE'), None)
    if armature_index is not None:
        while obj.modifiers.find(modifier.name) > armature_index:
            bpy.ops.object.modifier_move_up(modifier=modifier.name)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def duplicate_lod(source, base_name, level, ratio, mode):
    if source.data.shape_keys and len(source.data.shape_keys.key_blocks) > 1:
        raise RuntimeError(f'{source.name}: shape keys require authored LOD; automatic decimation refused')
    if mode == 'character' and not source.vertex_groups:
        raise RuntimeError(f'{source.name}: character LOD requires skin vertex groups')
    before=silhouette(source); source_triangles=triangles(source); source_materials=len(source.material_slots); source_uv=len(source.data.uv_layers)
    clone=source.copy(); clone.data=source.data.copy(); clone.animation_data_clear(); clone.name=f'{base_name}_LOD{level}'; clone.data.name=f'{base_name}_LOD{level}_Mesh'; source.users_collection[0].objects.link(clone)
    decimate(clone, ratio)
    after=silhouette(clone); errors=quality_check(before, after, level)
    if len(clone.material_slots) != source_materials: errors.append('material slot count changed')
    if len(clone.data.uv_layers) != source_uv: errors.append('UV layer count changed')
    if mode == 'character' and len(clone.vertex_groups) != len(source.vertex_groups): errors.append('skin vertex groups changed')
    if errors:
        bpy.data.objects.remove(clone, do_unlink=True)
        raise RuntimeError(f'{source.name} LOD{level}: ' + ', '.join(errors))
    clone['soul_lod_level']=level; clone['soul_lod_source']=source.name; clone['soul_lod_ratio']=ratio
    return clone, {'name':clone.name,'level':level,'ratio':ratio,'sourceTriangles':source_triangles,'triangles':triangles(clone),'silhouette':after}


def main():
    args=cli_args(); import_source(args['input'])
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.name.endswith(('_LOD1','_LOD2'))]
    explicit=[o for o in meshes if o.name.endswith('_LOD0')]
    sources=explicit or meshes
    audit={'version':1,'mode':args['mode'],'input':args['input'],'output':args['output'],'objects':[],'errors':[]}
    for source in sources:
        if triangles(source) < 64: continue
        base=source.name[:-5] if source.name.endswith('_LOD0') else source.name
        if not source.name.endswith('_LOD0'): source.name=f'{base}_LOD0'
        row={'source':source.name,'triangles':triangles(source),'silhouette':silhouette(source),'lods':[]}
        try:
            for level,ratio in ((1,args['lod1']),(2,args['lod2'])):
                _,info=duplicate_lod(source,base,level,ratio,args['mode']); row['lods'].append(info)
        except Exception as exc:
            audit['errors'].append(str(exc)); row['error']=str(exc)
        audit['objects'].append(row)
    if audit['errors']:
        os.makedirs(os.path.dirname(os.path.abspath(args['audit'])), exist_ok=True)
        with open(args['audit'],'w',encoding='utf-8') as f: json.dump(audit,f,ensure_ascii=False,indent=2)
        raise RuntimeError('; '.join(audit['errors']))
    os.makedirs(os.path.dirname(os.path.abspath(args['output'])), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(args['output']),export_format='GLB',export_extras=True,export_yup=True)
    with open(args['audit'],'w',encoding='utf-8') as f: json.dump(audit,f,ensure_ascii=False,indent=2)
    print(json.dumps({'output':args['output'],'audit':args['audit'],'objects':len(audit['objects'])}))


if __name__ == '__main__': main()
