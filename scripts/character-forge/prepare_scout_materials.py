"""Measured material evidence from isolated reference regions; upstream only."""
import argparse,json,sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,write_json

def prepare(w,cache):
    install=install_boundary(cache,cache/'host')
    sys.path.insert(0,str(install['engine']/'forge/stage1_intake'))
    from extract_pbr_evidence import extract
    from extract_part_color_recipe import build_recipe
    sys.path.insert(0,str(install['engine']/'forge'))
    from materials.reference import build_assignment
    rows={
        'skin':('front',[60,48,120,96],'skin'),
        'hair':('back',[45,10,138,130],'unknown'),
        'cloth':('front',[52,100,129,230],'fabric'),
        'pants':('front',[55,228,125,305],'fabric'),
        'boots':('front',[51,296,129,341],'unknown'),
    }
    result={}
    for mid,(view,bbox,hint) in rows.items():
        out=w/'img2threejs/evidence/materials'/mid;out.mkdir(parents=True,exist_ok=True)
        crop=out/'crop.png';Image.open(w/f'source/{view}.png').crop(bbox).convert('RGB').save(crop)
        report_path=out/'pbr-report.json'
        if report_path.exists():
            report=json.loads(report_path.read_text());patch=json.loads((out/'material-patch.json').read_text())
        else:
            report,patch=extract(argparse.Namespace(image=crop,out_dir=out,material_id=mid,size=1024,palette_size=5,target_threshold=.7,url_prefix='',multi_view_reference=True))
        recipe=build_recipe(mid,crop,material_class_hint=hint)
        profile={'skin':'skin.human','hair':'hair.human','cloth':'fabric.woven-matte','pants':'fabric.woven-matte','boots':'leather.matte'}[mid]
        assignment=build_assignment({'materialId':profile,'source':'inferred author material intent; not pixel classifier approval'},{'pbr':report,'classification':recipe})
        if not report['ok']: assignment['status']='probe'
        write_json(out/'assignment.json',assignment)
        write_json(out/'pbr-report.json',report);write_json(out/'material-patch.json',patch);write_json(out/'color-recipe.json',recipe)
        result[mid]={'source':f'source/{view}.png','pixelRect':bbox,'pbrConfidence':report['confidence'],'pbrPassed':report['ok'],'colorConfidence':recipe['materialClassConfidence']}
        print(mid,result[mid],flush=True)
        if not report['ok']:raise RuntimeError(f'Upstream material evidence below threshold: {mid}')
    write_json(w/'img2threejs/evidence/material-summary.json',result)
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);a=p.parse_args();prepare(a.workspace.resolve(),a.cache.resolve())
