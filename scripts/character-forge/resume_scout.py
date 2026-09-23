"""One explicitly authorized migration of the saved Scout correction budget.

Upstream lacks a resume CLI. Preserve its source, all reviews and counters, use
its state validator/recompute/save and then execute its actual next dispatcher.
This is task-specific policy data, not permission to auto-resume other stops.
"""
import argparse,copy,json,os,shutil,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,checked_run,write_json,sha256

def resume(w,cache,restore):
    source=ROOT/'docs/characters/qa/forge-upstream-blocked'
    policy=json.loads((ROOT/'scripts/character-forge/fixtures/upstream-scout-resume.json').read_text())
    if restore:
        # Hosted reconstruction replays the three accepted passes first. Adopt
        # the full saved authority, including the three failed material reviews.
        spec=json.loads((w/'object-sculpt-spec.json').read_text())
        if spec['sculptPipeline']['completedPasses']!=['blockout','structural-pass','form-refinement']:
            raise ValueError('Restore requires the three actual accepted pass replays')
        shutil.copyfile(source/'state.json',w/'.img2threejs/state.json')
        shutil.copyfile(source/'object-sculpt-spec.json',w/'object-sculpt-spec.json')
    state_path=w/'.img2threejs/state.json';spec_path=w/'object-sculpt-spec.json'
    for key,path in [('stateSha256',state_path),('specSha256',spec_path)]:
        if sha256(path)!=policy[key]:raise ValueError('Resume authorization does not match '+key)
    old=json.loads(state_path.read_text());spec=json.loads(spec_path.read_text())
    if old['status']!='stopped' or old['stopReason']!=policy['stopReason']:
        raise ValueError('Only the recorded correction-budget stop is authorized')
    if old['loops']!=policy['previousLoops']:raise ValueError('Correction history changed')
    install=install_boundary(cache,cache/'host')
    os.environ['IMG2_HOME']=str(install['home'])
    sys.path.insert(0,str(install['engine']/'forge/_shared'))
    from workflow_state import validate_state,recompute,save_state,sync_from_spec
    state=copy.deepcopy(old)
    state['loops'].update(policy['newLimits'])
    state['status']='active';state['stopReason']=''
    sync_from_spec(state,spec,state['currentPass']);recompute(state);validate_state(state)
    if state['status']!='active' or state['loops']['total']!=5 or state['loops']['perPass']!=old['loops']['perPass']:
        raise ValueError('Resume must preserve every recorded correction')
    if state['passHistory']!=old['passHistory'] or state['checklist']!=old['checklist']:
        raise ValueError('Resume changed reviewed work')
    write_json(w/'img2threejs/evidence/authorized-resume.json',{'policy':policy,'before':old,'after':state,'specSha256':sha256(spec_path),'upstreamSourceChanged':False,'qualityThresholdsChanged':False})
    save_state(state_path,state)
    return checked_run(install,w,'forge/next.py',['--state','.img2threejs/state.json'])

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);p.add_argument('--restore-reviewed-checkpoint',action='store_true');a=p.parse_args()
    raise SystemExit(resume(a.workspace.resolve(),a.cache.resolve(),a.restore_reviewed_checkpoint))
