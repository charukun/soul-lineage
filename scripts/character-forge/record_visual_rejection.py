"""Record an actual rejected capture and obey the upstream correction ceiling."""
import argparse,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,checked_run,write_json,sha256

def reject(w,cache,review_path):
    review=json.loads(review_path.read_text());p=review['pass'];out=w/'review'/p
    if review['action'] not in ('refine-code','refine-spec'):raise ValueError('A rejection must preserve its actual correction action')
    if sha256(w/f'build/{p}.ts')!=review['factorySha256']:raise ValueError('Rejected factory changed')
    for view,digest in review['captureSha256'].items():
        if sha256(out/(view+'.png'))!=digest:raise ValueError('Rejected capture changed: '+view)
    if json.loads((out/'render-receipt.json').read_text())['sourceHead']!=review['sourceHead']:raise ValueError('Rejected capture source head changed')
    spec=json.loads((w/'object-sculpt-spec.json').read_text());evidence=f'review/{p}/agent-rejection-{review["id"]}.json'
    if any(evidence in row.get('evidence',[]) for row in spec.get('reviewHistory',[])):raise ValueError('Rejection is already recorded; use next without duplicating the loop count')
    write_json(w/evidence,review);install=install_boundary(cache,cache/'host')
    files={}
    for key in ('layerScores','featureReviews','viewpoints'):
        files[key]=f'review/{p}/{review["id"]}-{key}.json';write_json(w/files[key],review[key])
    args=['object-sculpt-spec.json','--pass-id',p,'--action',review['action'],'--fidelity',str(review['fidelity']),'--ai-vision-score',str(review['fidelity']),'--summary',review['reason'],'--layer-scores-json',files['layerScores'],'--feature-reviews-json',files['featureReviews'],'--reference-screenshot','source/front.png','--render-screenshot',f'review/{p}/front.png','--comparison-image',f'review/{p}/front-comparison.png','--review-viewpoints-json',files['viewpoints'],'--evidence',evidence,'--require-screenshot-files','--in-place']
    code=checked_run(install,w,'forge/stage4_review/append_review.py',args)
    if code:return code
    code=checked_run(install,w,'forge/next.py',['--state','.img2threejs/state.json'])
    state=json.loads((w/'.img2threejs/state.json').read_text())
    if code==3:
        write_json(w/'BLOCKED.json',{'status':'BLOCKED','sourceHead':review['sourceHead'],'reviewId':review['id'],'reason':state['stopReason'],'loops':state['loops'],'qualityFloorPassed':False,'resumeCondition':'Explicit user decision on the upstream hard stop; no reset, increased limit, new workspace, or DCC bypass is authorized by this record. Then repair the UV bake and cross-view ownership, rerender all required views and obtain a new real review.','uncompleted':['material acceptance','surface','lighting','interaction','optimization','Golden Rig','Morph','Sockets','final package and registry','native Lab proof','latest develop reconcile','formal exact-head validation','Ready','develop merge','DEV deployment start']})
    return code

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);p.add_argument('--review',type=Path,required=True);a=p.parse_args();raise SystemExit(reject(a.workspace.resolve(),a.cache.resolve(),a.review.resolve()))
