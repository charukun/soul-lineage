"""Extract skin and suit evidence from inspected regions of the real reference."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,write_json

REGIONS={'skin':('front',(88,6,357,155),'skin'),
         'suit':('front',(136,272,310,472),'fabric')}


def prepare(w:Path,cache:Path)->dict:
    job=json.loads((w/'forge-job.json').read_text())
    if job['id']!='golden-base-v1':raise ValueError('Do not apply Golden Base crops to another model')
    install=install_boundary(cache,cache/'host')
    sys.path.insert(0,str(install['engine']/'forge/stage1_intake'))
    from extract_pbr_evidence import extract
    from extract_part_color_recipe import build_recipe
    result={}
    for mid,(view,box,hint) in REGIONS.items():
        out=w/'img2threejs/evidence/materials'/mid;out.mkdir(parents=True,exist_ok=True)
        crop=out/'crop.png'
        Image.open(w/f'source/{view}.png').crop(box).convert('RGB').save(crop)
        report,patch=extract(argparse.Namespace(image=crop,out_dir=out,material_id=mid,
                              size=1024,palette_size=5,target_threshold=.7,url_prefix='',
                              multi_view_reference=True))
        recipe=build_recipe(mid,crop,material_class_hint=hint)
        write_json(out/'pbr-report.json',report)
        write_json(out/'material-patch.json',patch)
        write_json(out/'color-recipe.json',recipe)
        result[mid]={'source':f'source/{view}.png','pixelRect':list(box),
                     'pbrConfidence':report['confidence'],'pbrPassed':report['ok'],
                     'colorConfidence':recipe['materialClassConfidence'],
                     'pixelStatus':'observed rendered RGB; physical PBR channels are inferred'}
        if not report['ok']:
            raise ValueError('Pinned upstream material confidence below minimum for '+mid)
    write_json(w/'img2threejs/evidence/material-summary.json',result)
    return result


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--workspace',type=Path,required=True)
    p.add_argument('--cache',type=Path,default=ROOT/'.cache/character-forge-upstream')
    a=p.parse_args();print(json.dumps(prepare(a.workspace.resolve(),a.cache.resolve())))
