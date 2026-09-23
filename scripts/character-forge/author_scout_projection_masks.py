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
from upstream_workspace import write_json,sha256,verify_sources

def author(w):
    verify_sources(w)
    maps_path=w/'img2threejs/evidence/projection/maps.json';maps=json.loads(maps_path.read_text())
    labels={'skin':['e4b089'],'hair':['294064'],'cloth':['2d9db0','315f95','dcb761'],'pants':['243a55'],'boots':['ad6133']}
    components={'skin':['neck']+[p+'-'+s for p in ('upper-arm','forearm','hand') for s in ('l','r')],
                'hair':['hair'],'cloth':['chest','pelvis'],'pants':[p+'-'+s for p in ('thigh','shin') for s in ('l','r')],'boots':['boot-l','boot-r']}
    reports=[]
    for view in ('front','side','back'):
        source=w/f'source/{view}.png';image=Image.open(source).convert('RGB');pixels=list(image.getdata())
        out=w/f'img2threejs/evidence/projection/{view}';maps[view]['componentMasks']={}
        for label,colors in labels.items():
            rgb={tuple(bytes.fromhex(c)) for c in colors};values=[255 if p in rgb else 0 for p in pixels]
            if not any(values):raise ValueError(f'Observed {label} label absent in {view}')
            path=out/f'ownership-{label}.png';mask=Image.new('L',image.size);mask.putdata(values);mask.save(path)
            for component in components[label]:maps[view]['componentMasks'][component]=str(path.relative_to(w))
            reports.append({'view':view,'label':label,'components':components[label],'sourceSha256':sha256(source),'maskSha256':sha256(path),'sourceColors':colors,'observedPixels':sum(v>0 for v in values)})
    write_json(maps_path,maps)
    spec_path=w/'object-sculpt-spec.json';spec=json.loads(spec_path.read_text())
    spec['projectionBake']['physicalChannelApplication']={'policy':'flat-illustration-albedo-only','status':'inferred matte response','reason':'The original flat-color illustration contains no measured relief or occlusion. Keep upstream extracted physical maps as inferred evidence but do not apply color edges as physical grooves. Albedo remains the actual de-lit source.'}
    write_json(spec_path,spec)
    write_json(w/'img2threejs/evidence/projection/surface-ownership.json',{'status':'observed labels of original flat-color fixture; not a photographic segmentation claim','source':'independently authored source pixels; source images and albedo unchanged','missingEvidence':'Source-occluded or contradictory surfaces remain inferred; never copy a different body part into them','reports':reports})

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);a=p.parse_args();author(a.workspace.resolve())
