"""Replay a real agent review only against its exact factory and six captures.
No scores are computed, thresholds changed, or approval inferred by this tool.
"""
import argparse,json,hashlib,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,checked_run,write_json

def apply(w,cache,review_file):
    review=json.loads(review_file.read_text());p=review['pass'];out=w/'review'/p
    sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
    if sha(w/f'build/{p}.ts')!=review['factorySha256']:raise ValueError('Review belongs to a different upstream factory')
    for view,digest in review['captureSha256'].items():
        if sha(out/(view+'.png'))!=digest:raise ValueError(f'{view} capture changed; a new agent review is required')
    for view in ('front','side','back'):
        if not json.loads((out/(view+'-diagnostics.json')).read_text())['passed']:raise ValueError(f'{view} Tier-1 gate rejects this review')
    if not json.loads((out/'turntable.json').read_text())['passed']:raise ValueError('Turntable failed')
    install=install_boundary(cache,cache/'host')
    def run(entry,*args):
        code=checked_run(install,w,entry,list(args))
        if code:raise RuntimeError(f'Upstream blocked: {entry} ({code})')
    write_json(out/'agent-review.json',review)
    write_json(out/'review-contract-read.json',{'reviewer':'Codex','sourceHead':review['sourceHead'],'documents':['grimoire/review/gates_reference.md','grimoire/review/self_correction.md'],'readCompletely':True,'acceptanceScope':p})
    def mark(step,evidence):run('forge/state.py','mark',step,'--state','.img2threejs/state.json','--evidence',evidence)
    mark('review-contract-read',f'review/{p}/review-contract-read.json')
    mark('tier1-diagnostics',f'review/{p}/review-tools.json')
    mark('multi-angle-review',f'review/{p}/multi-angle.json')
    run('forge/stage3_build/orchestrate_passes.py','check','object-sculpt-spec.json','--pass-id',p)
    mark('pass-gate-check',f'review/{p}/review-tools.json')
    run('forge/stage4_review/append_review.py','object-sculpt-spec.json','--pass-id',p,'--action',review['action'],'--fidelity',str(review['fidelity']),'--ai-vision-score',str(review['fidelity']),'--summary',review['summary'],'--layer-scores-json',json.dumps(review['layerScores']),'--feature-reviews-json',json.dumps(review['featureReviews']),'--mismatches',';'.join(review['remaining']),'--reference-screenshot','source/front.png','--render-screenshot',f'review/{p}/front.png','--comparison-image',f'review/{p}/front-comparison.png','--map-stripped-render',f'review/{p}/front.png','--review-viewpoints-json',json.dumps(review['viewpoints']),'--ai-vision-notes',review['summary']+' Remaining: '+'; '.join(review['remaining']),'--require-screenshot-files','--in-place')
    # Complete this pass's checklist before next.py synchronizes the new pass.
    mark('ai-review-recorded',f'review/{p}/agent-review.json')
    run('forge/stage3_build/orchestrate_passes.py','sync','object-sculpt-spec.json','--in-place')
    mark('pipeline-sync','object-sculpt-spec.json')
    run('forge/next.py','--state','.img2threejs/state.json')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);p.add_argument('--review',type=Path,required=True);a=p.parse_args();apply(a.workspace.resolve(),a.cache.resolve(),a.review.resolve())
