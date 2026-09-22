from pathlib import Path
import os,json,base64,urllib.request,subprocess
REPO='charukun/soul-lineage';BASE='64c5391b7e531d6e9a8951b9d35d87fac5e9b0f4';LATEST='c000b40c53e84db93e590ce4443a6eb4463f49ce';HEAD='9d293787895d6141a5f523c5de3fb34d24ee6aec';PATH='apps/rinne/src/rebuild/renderer.js'
assert os.environ['GITHUB_REPOSITORY']==REPO
assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==HEAD
headers={'Authorization':'Bearer '+os.environ['GITHUB_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':'application/json'}
def read(ref):
 req=urllib.request.Request(f'https://api.github.com/repos/{REPO}/contents/{PATH}?ref={ref}',headers=headers)
 with urllib.request.urlopen(req) as response:return base64.b64decode(json.load(response)['content']).decode()
def reconcile(source):
 assert "createRinneWeapon" not in source
 start=source.index('  function blade(');end=source.index('  const interiors=',start)
 return "import {createRinneWeapon} from '@soul/assets/equipment/three';\n"+source[:start]+"  const weaponVisual=(id,mini=false)=>createRinneWeapon(THREE,id,mini);\n\n"+source[end:]
assert reconcile(read(BASE))==read(LATEST),'Unexpected renderer drift: re-review instead of overwrite'
source=reconcile(Path(PATH).read_text());Path(PATH).write_text(source)
subprocess.run(['git','diff','--check'],check=True)
req=urllib.request.Request(f'https://api.github.com/repos/{REPO}/git/blobs',data=json.dumps({'content':source,'encoding':'utf-8'}).encode(),method='POST',headers=headers)
with urllib.request.urlopen(req) as response:blob=json.load(response)
out=Path('/tmp/camera-equipment-reconcile');out.mkdir(exist_ok=True);(out/'renderer.js').write_text(source);(out/'manifest.json').write_text(json.dumps({'candidate':HEAD,'base':BASE,'latest':LATEST,'files':[{'path':PATH,'mode':'100644','type':'blob','sha':blob['sha']}]},indent=2))
print('RECONCILED_RENDERER '+blob['sha'])
