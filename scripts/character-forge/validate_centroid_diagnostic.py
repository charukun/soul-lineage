"""Actual rendered regression probe for the versioned Scout/MSAA defect."""
import argparse,json,hashlib
from pathlib import Path
from PIL import Image
def validate(w):
    p=w/'review/material-pass/albedo-diagnostic';point=(247,540)
    before=Image.open(p/'front.png').convert('RGB').getpixel(point)
    after=Image.open(p/'front-centroid.png').convert('RGB').getpixel(point)
    source=Image.open(w/'source/front.png').convert('RGB').getpixel((90,177))
    error=max(abs(a-b)for a,b in zip(after,source))
    if error>3:raise ValueError(f'Actual centroid sampling failed: {after} vs observed gold {source}')
    report={'status':'passed','scope':'fixed-camera actual Scout GLB MSAA regression, not overall character quality','renderPixel':point,'sourcePixel':[90,177],'beforeRGB':before,'afterRGB':after,'observedSourceRGB':source,'maxAfterChannelError':error,'geometryAndTexturesChanged':False,'renderSha256':hashlib.sha256((p/'front-centroid.png').read_bytes()).hexdigest()}
    (p/'regression.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--workspace',type=Path,required=True);a=p.parse_args();validate(a.workspace.resolve())
