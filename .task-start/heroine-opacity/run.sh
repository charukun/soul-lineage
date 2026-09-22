set -euo pipefail
OUT=generated/heroine-opacity
python3 - <<'PY'
import json,hashlib,shutil
from pathlib import Path
out=Path('generated/heroine-opacity');p=json.loads(Path('apps/review/public/library/provenance/heroine-dawn-v1.json').read_text())
assert hashlib.sha256(Path(p['path']).read_bytes()).hexdigest()==p['sha256']
assert hashlib.sha256(Path(p['dccSourcePath']).read_bytes()).hexdigest()==p['dccSourceSha256']
(out/'integration.json').write_text(json.dumps({'modelSha256':p['sha256'],'meshPath':p['path'],'assetUrl':p['runtimeOrigin']+p['path'].split('/library/')[1]}))
shutil.copy2(p['path'],out/'Before.glb');shutil.copy2(p['dccSourcePath'],out/'Before.blend')
PY
blender --background assets/characters/heroine-dawn/source/HeroineDawn.blend --python-exit-code 1 --python-expr "import bpy; bpy.context.scene.world = bpy.context.scene.world or bpy.data.worlds.new('Inspection World')" --python scripts/blender/inspect-protagonist-villager-female-v1.py -- --out "$OUT/dcc-before" > "$OUT/dcc-before.log" 2>&1 || { tail -80 "$OUT/dcc-before.log"; exit 1; }
npm exec --workspace @soul/character-studio -- vite --host 127.0.0.1 --port 5177 --strictPort > "$OUT/vite.log" 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true; rm -f apps/character-studio/heroine-motion-probe.js' EXIT
for i in $(seq 1 60); do curl -fsS http://127.0.0.1:5177/ >/dev/null && break; sleep 1; done
node .task-start/heroine-opacity/observe-before.mjs "$OUT" > "$OUT/browser.log" 2>&1 || { tail -100 "$OUT/browser.log"; exit 1; }
cat "$OUT/browser.log"
python3 - <<'PY'
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
root=Path('generated/heroine-opacity')
for group,names in [('views',['front','three-quarter','side','back','face','mobile-390']),('motion',['motion-Idle-50','motion-Walking_A-28','motion-Walking_A-72','motion-1H_Melee_Attack_Chop-47','motion-Block-50','motion-Hit_A-40'])]:
 sheet=Image.new('RGB',(1200,1000),'#eeeeee');d=ImageDraw.Draw(sheet)
 for i,name in enumerate(names):
  img=Image.open(root/'runtime'/f'{name}.png').convert('RGB');img=ImageOps.contain(img,(390,460));x=(i%3)*400+(400-img.width)//2;y=(i//3)*500+25;sheet.paste(img,(x,y));d.text(((i%3)*400+10,(i//3)*500+5),name,fill='#111111')
 sheet.save(root/f'before-{group}.jpg',quality=92)
PY
