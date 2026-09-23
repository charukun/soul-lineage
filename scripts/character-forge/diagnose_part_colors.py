"""Observe actual visible part colours with the pinned upstream colour metric.

The unmodified global Tier-1 diagnostic clusters only five colours across the
entire frame. Its source explicitly says those are not per-component regions.
This diagnostic supplies the missing regions from actual GPU part-ID captures.
It does not override or rewrite the original gate, thresholds or state.
"""
import argparse,json,sys
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,write_json,sha256

def diagnose(w,cache,pass_id):
    install=install_boundary(cache,cache/'host')
    sys.path.insert(0,str(install['engine']/'forge/stage4_review'))
    from diagnose_render import per_part_color_delta
    out=w/'review'/pass_id;palettes=json.loads((out/'part-id-palette.json').read_text())
    spec=json.loads((w/'object-sculpt-spec.json').read_text());nodes={n['id']:n for n in spec['componentTree']}
    report={'upstreamFile':'forge/stage4_review/diagnose_render.py','upstreamAlgorithm':'per_part_color_delta (unmodified)','semantics':'Actual visible GPU part regions instead of the whole-frame coarse palette; same Lab delta calculation','authority':'diagnostic only; original Tier-1 gates unchanged','sourceHead':json.loads((out/'render-receipt.json').read_text())['sourceHead'],'views':{}}
    for view,palette in palettes.items():
        beauty_path=out/(view+'.png');ids_path=out/(view+'-part-ids.png')
        beauty=np.asarray(Image.open(beauty_path).convert('RGB'));ids=np.asarray(Image.open(ids_path).convert('RGB'))
        if beauty.shape!=ids.shape:raise ValueError('Part capture size differs from actual beauty capture')
        rows=[]
        for row in palette:
            cid=row['componentId'];node=nodes[cid]
            mask=np.all(ids==row['rgb'],axis=2)
            # Exclude AA/mixed boundary samples; retain actual visible interiors.
            interior=mask.copy()
            interior[1:-1,1:-1]&=mask[:-2,1:-1]&mask[2:,1:-1]&mask[1:-1,:-2]&mask[1:-1,2:]
            interior[[0,-1],:]=False;interior[:,[0,-1]]=False
            count=int(interior.sum())
            if count<16:
                rows.append({'componentId':cid,'visibleInteriorPixels':count,'status':'not measurable from this view; occluded or subpixel','passed':None});continue
            yy,xx=np.where(interior);y0,y1=int(yy.min()),int(yy.max())+1;x0,x1=int(xx.min()),int(xx.max())+1
            # Background padding lets the unchanged foreground segmenter detect
            # even a uniform-colour isolated crop without using frame corners.
            pixels=np.full((y1-y0+8,x1-x0+8,3),255,dtype=np.uint8)
            pixels[4:-4,4:-4]=np.where(interior[y0:y1,x0:x1,None],beauty[y0:y1,x0:x1],255)
            crop=out/'part-colors'/view/(cid+'.png');crop.parent.mkdir(parents=True,exist_ok=True);Image.fromarray(pixels).save(crop)
            recipe=node.get('colorMaterialRecipeByView',{}).get(view,node['colorMaterialRecipe'])
            measured=per_part_color_delta([dict(recipe,componentId=cid)],crop)
            rows.append({'componentId':cid,'visibleInteriorPixels':count,'crop':str(crop.relative_to(w)),'cropSha256':sha256(crop),'metric':measured,'passed':measured['checked']==1 and measured['maxDeltaE']<=20})
        report['views'][view]={'beautySha256':sha256(beauty_path),'partIdsSha256':sha256(ids_path),'originalGlobalTier1':json.loads((out/(view+'-diagnostics.json')).read_text()),'components':rows,'allMeasuredPartsWithin20':all(r['passed'] is not False for r in rows),'measuredParts':sum(r['passed'] is not None for r in rows)}
    write_json(out/'part-color-diagnostics.json',report)
    return {v:{'parts':d['measuredParts'],'allMeasuredPartsWithin20':d['allMeasuredPartsWithin20']}for v,d in report['views'].items()}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);p.add_argument('--pass-id',required=True);a=p.parse_args();print(json.dumps(diagnose(a.workspace.resolve(),a.cache.resolve(),a.pass_id)))
