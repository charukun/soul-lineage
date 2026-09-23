"""Audit the saved authoritative stop; do not rerun a stopped reconstruction."""
import json,os,shutil,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,checked_run,write_json
w=ROOT/'test-results/character-forge-upstream/blocked-state-audit';w.mkdir(parents=True,exist_ok=True)
source=ROOT/'docs/characters/qa/forge-upstream-blocked'
shutil.copyfile(source/'object-sculpt-spec.json',w/'object-sculpt-spec.json')
(w/'.img2threejs').mkdir(exist_ok=True);shutil.copyfile(source/'state.json',w/'.img2threejs/state.json')
cache=ROOT/'.cache/character-forge-upstream';install=install_boundary(cache,cache/'host')
code=checked_run(install,w,'forge/next.py',['--state','.img2threejs/state.json'])
state=json.loads((w/'.img2threejs/state.json').read_text());expected=json.loads((source/'blocker.json').read_text())
if code!=3 or state['status']!='stopped' or state['stopReason']!=expected['reason'] or state['loops']!=expected['loops']:
    raise RuntimeError('Saved upstream stop was not preserved')
write_json(w/'stop-audit.json',{'head':os.environ.get('HEAD_SHA'),'auditPassed':True,'reconstructionStatus':'BLOCKED','upstreamExitCode':code,'stopReason':state['stopReason'],'loops':state['loops'],'qualityFloorPassed':False,'notMergeValidation':True})
print('FORGE_BLOCKED_AUDIT '+json.dumps({'head':os.environ.get('HEAD_SHA'),'stopReason':state['stopReason'],'loops':state['loops']}))
raise SystemExit(3)
