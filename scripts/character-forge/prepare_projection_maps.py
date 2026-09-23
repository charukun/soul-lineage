"""Pinned pixel extraction plus full-image coordinate metadata for GPU baking.

The upstream PBR extractor crops foreground before resampling. Its crop rectangle
is retained, so projected UVs cannot silently stretch that crop over a full view.
Albedo comes from the preceding de-light stage; other physical channels are
independent upstream estimates, explicitly not observed physical measurements.
"""
import argparse,json,sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,write_json,verify_sources,checked_run

def prepare(w,cache):
    job=verify_sources(w);install=install_boundary(cache,cache/'host')
    sys.path.insert(0,str(install['engine']/'forge/stage1_intake'))
    from extract_pbr_evidence import extract,load_image,build_foreground_mask
    result={};cameras=json.loads((w/'img2threejs/evidence/cameras.json').read_text())
    for view,source in job['views'].items():
        if view not in ('front','side','back'):continue
        out=w/'img2threejs/evidence/projection'/view;out.mkdir(parents=True,exist_ok=True)
        image=w/source['path'];width,height,pixels,_=load_image(image)
        mask,diagnostics,warnings=build_foreground_mask(width,height,pixels)
        if any('tiny' in warning.lower() for warning in warnings):raise ValueError(f'{view}: foreground mask is not trustworthy')
        bitmap=Image.new('L',(width,height));bitmap.putdata([255 if value else 0 for value in mask]);bitmap.save(out/'foreground.png')
        report,patch=extract(argparse.Namespace(image=image,out_dir=out,material_id=view,size=1024,palette_size=5,target_threshold=.7,url_prefix='',multi_view_reference=len(job['views'])>1))
        write_json(out/'pbr-report.json',report)
        if not report['ok']:raise ValueError(f'{view}: upstream PBR evidence requires a probe')
        paths={key:str(Path(value['path']).relative_to(w)) for key,value in report['maps'].items()}
        paths['albedo']=f'build/textures/{view}-albedo.png'
        if not (w/paths['albedo']).is_file():raise ValueError(f'{view}: actual de-light pixels are required')
        camera_path=out/'camera.json';write_json(camera_path,{'referenceCamera':cameras[view]})
        code=checked_run(install,w,'forge/stage3_build/bake_projected_texture.py',['--reference-image',source['path'],'--delit-image',paths['albedo'],'--camera',str(camera_path.relative_to(w)),'--mesh-id',job['id'],'--projection-mode','perspective-camera-projection','--texture-size','1024','--unseen-strategy','mirror-symmetry','--out',str((out/'descriptor.json').relative_to(w))])
        if code:raise RuntimeError(f'{view}: upstream projection descriptor failed')
        result[view]={'maps':paths,'foregroundMask':str((out/'foreground.png').relative_to(w)),'imageSize':[width,height],'pbrCrop':report['diagnostics']['cropBBoxPixels'],'pbrConfidence':report['confidence'],'status':{'albedo':'observed pixels, approximately de-lit','normal':'inferred by pinned extractor','roughness':'inferred by pinned extractor','height':'inferred by pinned extractor','ao':'inferred by pinned extractor'},'maskDiagnostics':diagnostics,'warnings':warnings}
    if set(result)!=set(('front','side','back')):raise ValueError('This multi-view baker requires all three admitted views')
    write_json(w/'img2threejs/evidence/projection/maps.json',result)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);a=p.parse_args();prepare(a.workspace.resolve(),a.cache.resolve())
