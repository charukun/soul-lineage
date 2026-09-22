"""Task-scoped intake of the user's actual Golden Base Boy turnaround, not generated advertising art."""
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / '.dcc-work/golden-base-boy-v1/source-sheet.jpg'
OUT = ROOT / '.dcc-work/golden-base-boy-v1/references'
OUT.mkdir(parents=True, exist_ok=True)
image = Image.open(SOURCE).convert('RGB')
if image.size != (1408, 1056):
    raise ValueError(f'Unexpected original reference dimensions: {image.size}')
# Exact user-selected central views. Right implementation panels and footer never enter geometry measurements.
regions = {
    'front': (10, 150, 420, 781),
    'side': (419, 150, 670, 781),
    'back': (650, 150, 1058, 781),
}
# Row-dependent semantic bounds remove ruler, neighboring figures and the green display pads.
bands = {
    'front': [(150,406,85,348),(406,497,10,420),(497,601,135,295),(601,781,139,290)],
    'side': [(150,406,420,666),(406,611,469,603),(611,781,480,600)],
    'back': [(150,406,728,990),(406,499,650,1058),(499,603,778,944),(603,781,785,940)],
}
records = {}
for name, rect in regions.items():
    raw = image.crop(rect)
    raw.save(OUT / (name + '-raw.png'))
    pixels = np.asarray(raw).astype(np.int16)
    r,g,b = pixels[:,:,0],pixels[:,:,1],pixels[:,:,2]
    foreground = ((r-g > 3) | ((np.max(pixels,2)-np.min(pixels,2)<20)&(np.min(pixels,2)<238)) | ((b-r>12)&(np.min(pixels,2)<230)))
    foreground &= ~((g-r>3)&(g-b>3))
    allowed = Image.new('L', raw.size, 0)
    draw = ImageDraw.Draw(allowed)
    for y0,y1,x0,x1 in bands[name]:
        draw.rectangle((x0-rect[0],y0-rect[1],x1-rect[0],y1-rect[1]),fill=255)
    foreground &= np.asarray(allowed)>0
    mask = Image.fromarray(np.uint8(foreground)*255).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    # Fill only internal holes; retain the gap between legs and under arms.
    flood = mask.copy()
    ImageDraw.floodfill(flood,(0,0),128,thresh=0)
    data = np.asarray(flood)
    mask = Image.fromarray(np.uint8(data != 128)*255)
    rgba = raw.convert('RGBA'); rgba.putalpha(mask)
    rgba.save(OUT / (name+'.png'))
    records[name] = {'sheetRect':list(rect),'rawCropSha256':hashlib.sha256((OUT/(name+'-raw.png')).read_bytes()).hexdigest(),'inputSha256':hashlib.sha256((OUT/(name+'.png')).read_bytes()).hexdigest(),'maskMethod':'authored central-view bounds, background color mask and hole fill; original pixels retained','status':'observed image, inferred segmentation'}
provenance = {
    'author':'RINNE original procedural model; reference supplied by the commissioning user',
    'source':'User attachment 1000003576.png / Golden Base Boy v1, explicitly supplied to create this new Golden Base',
    'license':'RINNE-OWNED',
    'authorizationEvidence':'User explicitly instructed Character Create Forge creation from this attachment. No third-party character model, rig or texture library is imported.',
    'referenceAuthorship':'User-provided; independent original authorship not asserted',
    'originalSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'shapeAuthority':'Central Front / Side / Back figures only; right panels are implementation guidance',
    'excluded':'Previously generated presentation image; right technical thumbnails; footer dressed character',
    'bodyRatioPolicy':'Measure the actual central figures, do not force the decorative approximately-3.5 label over the drawn proportions',
    'sourceViews':records,
}
prov = OUT/'provenance.json'; prov.write_text(json.dumps(provenance,indent=2),encoding='utf-8')
cmd = [sys.executable,str(ROOT/'packages/assets/forge/pipeline.py'),'--id','golden-base-boy-v1','--name','Golden Base Boy v1','--provenance',str(prov),'--root',str(ROOT)]
for name in ('front','side','back'): cmd += ['--'+name,str(OUT/(name+'.png'))]
target = ROOT/'packages/assets/characters/forge/golden-base-boy-v1'
if (target/'manifest.json').exists(): cmd += ['--replace']
subprocess.run(cmd,check=True)
shutil.copy2(SOURCE,target/'source/original-user-sheet.jpg')
shutil.copy2(prov,target/'source/provenance.json')
for name in ('front','side','back'): shutil.copy2(OUT/(name+'-raw.png'),target/'source'/(name+'-raw-crop.png'))
request = {'target':'reusable Golden Base only','newMesh':True,'hair':False,'garments':False,'accessories':False,'grayRegion':'neutral base material region, not a separate garment','required':['clean topology','UV','materials','Golden Rig compatibility','real morph targets','Head/LeftHand/RightHand/Weapon sockets','Blender edit and actual turnaround comparison'],'reviewStatus':'DCC refinement required; pipeline candidate is not completion','sourceHead':'2724d7afce29f6ab7e19374450741a968d54b857'}
(target/'golden-base-request.json').write_text(json.dumps(request,indent=2),encoding='utf-8')
print(json.dumps({'stage':'FORGE_CLI_EXECUTED','id':'golden-base-boy-v1','originalSha256':provenance['originalSha256'],'dccApproval':False}))
