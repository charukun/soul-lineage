"""Bulk data-plane blobs/tree only. The Connector owns commit/ref advancement.
Allowed destination: charukun/soul-lineage; only this task's assets and evidence.
"""
import base64, hashlib, json, os, shutil, subprocess, urllib.request
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
assert os.environ['GITHUB_REPOSITORY'] == 'charukun/soul-lineage'
root = Path('generated/heroine-opacity'); meta = json.loads((root/'materialized.json').read_text()); qa = Path(meta['qa']); report = Path('docs/characters/qa/heroine-opacity-v1'); report.mkdir(parents=True, exist_ok=True)
run = f"https://github.com/charukun/soul-lineage/actions/runs/{os.environ['GITHUB_RUN_ID']}"
def copy(a,b): Path(b).parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(a,b)
views=['front','three-quarter','side','back','face','mobile-390']; legacy=['motion-Idle-50','motion-Walking_A-28','motion-Walking_A-72','motion-1H_Melee_Attack_Chop-47','motion-Block-50','motion-Hit_A-40']
def sheet(source,names,destination,columns=3):
    rows=(len(names)+columns-1)//columns; tilew=360; tileh=360
    image=Image.new('RGB',(columns*tilew,rows*tileh),'#eeeeee'); draw=ImageDraw.Draw(image)
    for i,name in enumerate(names):
        frame=ImageOps.contain(Image.open(source/(name+'.png')).convert('RGB'),(tilew-8,tileh-28)); x=(i%columns)*tilew+(tilew-frame.width)//2; y=(i//columns)*tileh+24; image.paste(frame,(x,y)); draw.text(((i%columns)*tilew+5,(i//columns)*tileh+5),name.replace('matrix-',''),fill='#111111')
    image.save(destination,quality=91)
for phase in ['before','after']:
    source=root/phase; receipt=json.loads((source/'receipt.json').read_text()); receipt['captureRun']=run; receipt['rawCaptureLocation']='heroine-opacity-'+os.environ['GITHUB_SHA']+'/'+phase
    (source/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n'); copy(source/'receipt.json',report/(phase+'-receipt.json'))
    for group,names in [('views',views),('motion',legacy)]: sheet(source,names,report/(phase+'-'+group+'.jpg'))
    for clip in ['Idle','Walking_A','1H_Melee_Attack_Chop','Hit_A']:
        names=[f'matrix-{clip}-{fraction}-{view}' for fraction in [2,25,50,75,98] for view in ['front','three-quarter','side','back']]
        sheet(source,names,report/(phase+'-'+clip+'.jpg'),4)
for name in views+legacy+['opposite-side-attack','studio-ui']: copy(root/'after'/(name+'.png'),qa/'runtime'/(name+'.png'))
copy(root/'after'/'receipt.json',qa/'runtime'/'receipt.json')
for view in ['front','three-quarter','side','back','face']: copy(root/'dcc-after'/(view+'.png'),qa/('dcc-'+view+'.png'))
review={'schema':'rinne-heroine-opacity-review','baselineSourceSha':os.environ['GITHUB_SHA'],'baselineModelSha256':'777f0c4f7f910edf85ab66011fddf961b7144a4a129212cf8a0b5a1b73937678','modelSha256':meta['modelSha256'],'captureRun':run,'before':'before-receipt.json','after':'after-receipt.json','sameCameraLightingAndPoseRecipe':True,'runtimeViewsPerPhase':6,'motionMatrixCapturesPerPhase':80,'playbackSpeed':1,'observedByWorker':'pending artifact visual review','humanArtApproval':'pending','hardwareAcceptance':'not-measured'}
(report/'review.json').write_text(json.dumps(review,indent=2)+'\n')
paths=[meta['mesh'],meta['sourcePath'],'assets/characters/heroine-dawn/source/HeroineDawnPalette.png','apps/review/public/library/provenance/heroine-dawn-v1.json','packages/characters/src/reference-model-catalog.js','packages/characters/production/protagonist-villager-female-v1.production.json']
paths += [f'apps/{a}/public/simulator/assets/PROTAGONIST_VILLAGER_FEMALE_V1.asset.json' for a in ['rinne','character-studio']]
paths += [str(p) for base in [qa,report] for p in base.rglob('*') if p.is_file() and p.suffix in {'.json','.png','.jpg','.md'}]
basehead=os.environ['GITHUB_SHA']; basetree=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],text=True).strip()
def request(endpoint,payload):
    req=urllib.request.Request('https://api.github.com/repos/charukun/soul-lineage/'+endpoint,data=json.dumps(payload).encode(),headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},method='POST')
    with urllib.request.urlopen(req,timeout=90) as response:return json.load(response)
entries=[]
for name in sorted(set(paths)):
    body=Path(name).read_bytes(); sha=hashlib.sha1(f'blob {len(body)}\0'.encode()+body).hexdigest()
    prior=subprocess.run(['git','rev-parse','HEAD:'+name],capture_output=True,text=True)
    if prior.returncode==0 and prior.stdout.strip()==sha:continue
    returned=request('git/blobs',{'content':base64.b64encode(body).decode(),'encoding':'base64'}); assert returned['sha']==sha
    entries.append({'path':name,'mode':'100644','type':'blob','sha':sha})
entries.append({'path':meta['old'],'mode':'100644','type':'blob','sha':None})
tree=request('git/trees',{'base_tree':basetree,'tree':entries})
(root/'delivery.json').write_text(json.dumps({'baseHead':basehead,'baseTree':basetree,'treeSha':tree['sha'],'modelSha256':meta['modelSha256'],'captureRun':run,'entries':entries},indent=2))
print(json.dumps({'baseHead':basehead,'treeSha':tree['sha'],'assetSha256':meta['modelSha256'],'changedFiles':len(entries)}))
