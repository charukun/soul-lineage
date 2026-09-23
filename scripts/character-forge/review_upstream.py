"""Run pinned upstream review tools on real browser captures; never auto-approve.

The hull GLB is only a container conversion of upstream vertices/indices. It is
an inferred silhouette constraint, not a scanned ground-truth reference mesh.
"""
import argparse,json,struct,sys,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,checked_run,write_json

def hull_glb(hull,out):
    points=hull['vertices']; indices=hull['indices']
    pos=struct.pack('<'+'f'*len(points)*3,*(v for p in points for v in p))
    ind=struct.pack('<'+'I'*len(indices),*indices)
    payload=pos+ind
    doc={'asset':{'version':'2.0','generator':'RINNE container adapter for exact upstream visual hull'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0}],'meshes':[{'primitives':[{'attributes':{'POSITION':0},'indices':1}]}],
      'buffers':[{'byteLength':len(payload)}], 'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':len(pos),'target':34962},{'buffer':0,'byteOffset':len(pos),'byteLength':len(ind),'target':34963}],
      'accessors':[{'bufferView':0,'componentType':5126,'count':len(points),'type':'VEC3','min':[min(p[i] for p in points) for i in range(3)],'max':[max(p[i] for p in points) for i in range(3)]},{'bufferView':1,'componentType':5125,'count':len(indices),'type':'SCALAR'}]}
    data=json.dumps(doc,separators=(',',':')).encode();data+=b' '*(-len(data)%4)
    out.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(data)+len(payload))+struct.pack('<I4s',len(data),b'JSON')+data+struct.pack('<I4s',len(payload),b'BIN\0')+payload)

def review(w,cache,pass_id):
    install=install_boundary(cache,cache/'host'); out=w/'review'/pass_id
    receipt=json.loads((out/'render-receipt.json').read_text())
    if receipt['errors']:raise ValueError('Browser errors invalidate review inputs')
    results=[]
    def run(name,entry,*args):
        code=checked_run(install,w,entry,list(args))
        logs=w/'img2threejs/commands';record=sorted(logs.glob('*.json'))[-1]
        dest=out/(name+'.json')
        try:write_json(dest,json.loads(record.with_suffix('.stdout.txt').read_text()))
        except json.JSONDecodeError:shutil.copyfile(record.with_suffix('.stdout.txt'),out/(name+'.txt'))
        results.append({'name':name,'returnCode':code,'receipt':str(record.relative_to(w))})
        return code
    for view in ('front','side','back'):
        source=f'source/{view}.png';render=f'review/{pass_id}/{view}.png'
        run(view+'-diagnostics','forge/stage4_review/diagnose_render.py','--reference',source,'--render',render,'--spec','object-sculpt-spec.json','--pass-id',pass_id,'--json',*(['--in-place'] if view=='front' else []),*(['--map-stripped-render',render] if pass_id=='blockout' else []))
        run(view+'-divine-eye','forge/stage4_review/divine_eye.py','--reference',source,'--render',render,'--json')
        run(view+'-interior','forge/stage4_review/interior_difference.py',source,render,'--json')
        # A diagnostic sheet is retained on rejection too, but no VLM acceptance
        # or continue decision is allowed past an upstream hard gate failure.
        run(view+'-comparison','forge/stage4_review/make_comparison_sheet.py','--reference',source,'--render',render,'--out',f'review/{pass_id}/{view}-comparison.png','--panel-width','360','--panel-height','720','--json')
    run('multi-angle','forge/stage4_review/diagnose_render_multi_angle.py','--reference',f'review/{pass_id}/front.png','--orbit',f'review/{pass_id}/side.png','--orbit',f'review/{pass_id}/back.png','--orbit',f'review/{pass_id}/front34.png','--orbit',f'review/{pass_id}/rear34.png','--json')
    run('turntable','forge/stage4_review/turntable_gate.py','--capture',f'0=review/{pass_id}/front.png','--capture',f'90=review/{pass_id}/side.png','--capture',f'180=review/{pass_id}/back.png','--capture',f'270=review/{pass_id}/oppositeSide.png','--json')
    write_json(out/'parts.json',{'model':'upstream-scout','parts':receipt['parts'],'unnamedMeshes':sum(not p['name'] for p in receipt['parts'])})
    run('part-coverage','forge/stage4_review/check_part_coverage.py','--spec','object-sculpt-spec.json','--manifest',f'review/{pass_id}/parts.json','--json',f'review/{pass_id}/part-coverage.json')
    if (out/'scalp-exposure.json').exists():
        run('hair-gate','forge/stage4_review/hair_gate.py','--reference',*[f'{v}=source/{v}.png' for v in ('front','side','back')],'--render',*[f'{v}=review/{pass_id}/{v}.png' for v in ('front','side','back')],'--scalp-exposure',f'review/{pass_id}/scalp-exposure.json','--out',f'review/{pass_id}/hair-gate.json')
    hull=json.loads((w/'img2threejs/evidence/visual-hull.json').read_text());hull_glb(hull,out/'hull-constraint.glb')
    run('mesh-constraint-comparison','forge/stage4_review/mesh_reference_compare.py',f'review/{pass_id}/hull-constraint.glb',f'build/{pass_id}.glb','--bands','20','--align','height','--json')
    write_json(out/'review-tools.json',{'sourceHead':receipt['sourceHead'],'factorySha256':receipt['factorySha256'],'pass':pass_id,'tools':results,'visualApproval':'pending','constraintReference':{'status':'inferred','source':'exact upstream front/side silhouette hull','limitations':hull['limitations'],'notGroundTruth':True}})
    print(json.dumps({'pass':pass_id,'tools':results,'visualApproval':'pending'}))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);p.add_argument('--pass-id',default='blockout');a=p.parse_args();review(a.workspace.resolve(),a.cache.resolve(),a.pass_id)
