from pathlib import Path
import os,json,base64,urllib.request,subprocess,difflib
REPO='charukun/soul-lineage';BASE='64c5391b7e531d6e9a8951b9d35d87fac5e9b0f4';LATEST='c000b40c53e84db93e590ce4443a6eb4463f49ce';HEAD='9d293787895d6141a5f523c5de3fb34d24ee6aec';PATH='apps/rinne/src/rebuild/renderer.js'
assert os.environ['GITHUB_REPOSITORY']==REPO
assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==HEAD
headers={'Authorization':'Bearer '+os.environ['GITHUB_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':'application/json'}
def read(ref):
 req=urllib.request.Request(f'https://api.github.com/repos/{REPO}/contents/{PATH}?ref={ref}',headers=headers)
 with urllib.request.urlopen(req) as response:return base64.b64decode(json.load(response)['content']).decode()
def reconcile(source):
 assert 'createRinneWeapon' not in source
 start=source.index('  function blade(');end=source.index('  const interiors=',start)
 # PR1485 reviewed three hunks: import, shared weapon factory, one trailing blank line.
 return "import {createRinneWeapon} from '@soul/assets/equipment/three';\n"+source[:start]+"  const weaponVisual=(id,mini=false)=>createRinneWeapon(THREE,id,mini);\n\n"+source[end:]+'\n'
base,latest,current=read(BASE),read(LATEST),Path(PATH).read_text()
assert reconcile(base)==latest,'Unexpected incoming delta: stop, do not overwrite'
source=reconcile(current);assert 'createRinnePresentationCamera' in source
Path(PATH).write_text(source)
req=urllib.request.Request(f'https://api.github.com/repos/{REPO}/git/blobs',data=json.dumps({'content':source,'encoding':'utf-8'}).encode(),method='POST',headers=headers)
with urllib.request.urlopen(req) as response:blob=json.load(response)
out=Path('/tmp/camera-equipment-reconcile');out.mkdir(exist_ok=True);(out/'renderer.js').write_text(source)
(out/'incoming.diff').write_text(''.join(difflib.unified_diff(base.splitlines(True),latest.splitlines(True),fromfile=BASE,tofile=LATEST)))
(out/'integrated.diff').write_text(''.join(difflib.unified_diff(current.splitlines(True),source.splitlines(True),fromfile=HEAD,tofile='reconciled')))
(out/'manifest.json').write_text(json.dumps({'candidate':HEAD,'base':BASE,'latest':LATEST,'files':[{'path':PATH,'mode':'100644','type':'blob','sha':blob['sha']}]},indent=2))
print('RECONCILED_RENDERER '+blob['sha'])
