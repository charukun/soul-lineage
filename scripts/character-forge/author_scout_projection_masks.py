"""Scout-specific observed surface labels; never a replacement segmentation model.

These independently drawn flat-color reference pixels have exact authored labels.
The labels restrict which source surface may project onto each component; they
do not replace albedo or turn a hidden surface into observed evidence. Other
characters need their own reviewed masks (e.g. the upstream vision adapter).
"""
import argparse,json,sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import write_json,sha256,verify_sources,install_boundary,checked_run

def author(w):
    verify_sources(w)
    cache=ROOT/'.cache/character-forge-upstream';install=install_boundary(cache,cache/'host')
    # This particular source is programmatically drawn with flat RGB fills and
    # no illumination. The upstream's explicit zero-strength mode is the correct
    # de-light operation for that known input, not a photographic default.
    for view in ('front','side','back'):
        code=checked_run(install,w,'forge/stage1_intake/delight_albedo.py',[f'source/{view}.png','--out',f'build/textures/{view}-albedo.png','--report',f'img2threejs/evidence/{view}-delight.json','--strength','0'])
        if code:raise RuntimeError('Pinned de-light failed')
        if Image.open(w/f'source/{view}.png').convert('RGBA').tobytes()!=Image.open(w/f'build/textures/{view}-albedo.png').convert('RGBA').tobytes():raise ValueError('Unlit fixture pixels must remain exact after de-light')
    maps_path=w/'img2threejs/evidence/projection/maps.json';maps=json.loads(maps_path.read_text())
    labels={'skin':['e4b089'],'hair':['294064'],'cloth':['2d9db0','315f95','dcb761'],'pants':['243a55'],'boots':['ad6133']}
    components={'skin':['neck']+[p+'-'+s for p in ('upper-arm','forearm','hand') for s in ('l','r')],
                'hair':['hair'],'cloth':['chest','pelvis'],'pants':[p+'-'+s for p in ('thigh','shin') for s in ('l','r')],'boots':['boot-l','boot-r']}
    reports=[]
    for view in ('front','side','back'):
        source=w/f'source/{view}.png';image=Image.open(source).convert('RGB');pixels=list(image.getdata())
        out=w/f'img2threejs/evidence/projection/{view}';maps[view]['componentMasks']={};maps[view]['componentAlbedoBounds']={}
        for label,colors in labels.items():
            rgb={tuple(bytes.fromhex(c)) for c in colors};values=[255 if p in rgb else 0 for p in pixels]
            if not any(values):raise ValueError(f'Observed {label} label absent in {view}')
            path=out/f'ownership-{label}.png';mask=Image.new('L',image.size);mask.putdata(values);mask.save(path)
            for component in components[label]:
                maps[view]['componentMasks'][component]=str(path.relative_to(w))
                maps[view]['componentAlbedoBounds'][component]={'min':[min(p[i] for p in rgb) for i in range(3)],'max':[max(p[i] for p in rgb) for i in range(3)]}
            reports.append({'view':view,'label':label,'components':components[label],'sourceSha256':sha256(source),'maskSha256':sha256(path),'sourceColors':colors,'observedPixels':sum(v>0 for v in values)})
    write_json(maps_path,maps)
    spec_path=w/'object-sculpt-spec.json';spec=json.loads(spec_path.read_text())
    spec['projectionBake']['physicalChannelApplication']={'policy':'upstream-estimates','status':'inferred physical channels, all applied; not measured material properties','reason':'The r4 albedo-only ablation did not remove the grooves: the defect was source mip filtering and depth sampling. Restore every independent upstream physical map.'}
    spec['projectionBake']['delightDecision']={'strength':0,'scope':'Only this original programmatic flat-fill Scout fixture','evidence':'scripts/character-forge/fixture.py draws no illumination; source/output RGBA byte parity checked','semantics':'Execute pinned delight_albedo.py explicit passthrough mode for already unlit pixels. Other images require their own lighting assessment.'}
    write_json(spec_path,spec)
    write_json(w/'img2threejs/evidence/projection/surface-ownership.json',{'status':'observed labels of original flat-color fixture; not a photographic segmentation claim','source':'independently authored source pixels; source images and albedo unchanged','missingEvidence':'Source-occluded or contradictory surfaces remain inferred; never copy a different body part into them','reports':reports})

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);a=p.parse_args();author(a.workspace.resolve())
