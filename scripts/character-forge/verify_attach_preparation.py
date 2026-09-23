# UNVALIDATED PREPARATION: preserved at user-requested pause; not executed on Scout.
"""Check actual before/after captures before freezing the mesh for rigging."""
import argparse,json,sys
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import write_json,sha256

def verify(w):
    out=w/'review/pre-rig';receipt=json.loads((out/'receipt.json').read_text())
    review=json.loads((w/'review/optimization-pass/agent-review.json').read_text())
    if review.get('qualityFloorPassed') is not True or receipt['reviewId']!=review['id']:
        raise ValueError('The actual raw-likeness review is missing or changed')
    for key,path in [('modelSha256','build/optimization-pass.glb'),('meshPayloadSha256','build/rig/meshes-before.json')]:
        if receipt[key]!=sha256(w/path):raise ValueError('Preparation bytes changed')
    rows=[]
    for view in receipt['views']:
        before=Image.open(out/(view+'-before.png')).convert('RGB')
        after=Image.open(out/(view+'-after.png')).convert('RGB')
        if before.size!=after.size:raise ValueError('Capture sizes differ')
        delta=ImageChops.difference(before,after);channels=delta.split()
        maximum=ImageChops.lighter(ImageChops.lighter(channels[0],channels[1]),channels[2])
        row={'view':view,'meanChannelDelta':sum(ImageStat.Stat(delta).mean)/3,'fractionPixelsOver8':sum(maximum.histogram()[9:])/(before.width*before.height),'beforeSha256':sha256(out/(view+'-before.png')),'afterSha256':sha256(out/(view+'-after.png'))}
        rows.append(row)
        # Float32 world-space transport may move a small number of silhouette
        # AA samples. This bounds that numerical effect, never deformation.
        if row['meanChannelDelta']>.05 or row['fractionPixelsOver8']>.0002:
            raise ValueError('Attach-space preparation changed visible likeness: '+view)
    write_json(out/'parity.json',{'passed':True,'scope':'Attach-space transport before the immutable upstream freeze','measurements':rows})
    write_json(w/'review/reconstruction-acceptance.json',{'qualityFloorPassed':True,'scope':'Raw reconstruction likeness only; actual Rig/Morph/Sockets/animations and native Lab remain mandatory','reviewId':review['id'],'sourceHead':receipt['sourceHead'],'modelSha256':receipt['modelSha256'],'meshPayloadSha256':receipt['meshPayloadSha256'],'attachmentParity':'review/pre-rig/parity.json','acceptedPasses':json.loads((w/'object-sculpt-spec.json').read_text())['sculptPipeline']['completedPasses']})
    return rows

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);a=p.parse_args();print(json.dumps(verify(a.workspace.resolve())))
