"""Author evidence-scoped surface responses after actual material acceptance."""
import argparse,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,checked_run,write_json,verify_sources,sha256

def author(w,cache):
    verify_sources(w)
    path=w/'object-sculpt-spec.json';spec=json.loads(path.read_text())
    if spec['sculptPipeline']['currentPass']!='surface-pass':raise ValueError('Actual material acceptance must precede surface authoring')
    review=json.loads((w/'review/material-pass/agent-review.json').read_text())
    if review['action']!='continue':raise ValueError('Material review is not accepted')
    prior=json.loads((w/'review/material-pass/projection-bake.json').read_text())
    by_name={r['mesh']:r for r in prior['outputs']};responses={};evidence=[]
    for node in spec['componentTree']:
        if node['material']=='hidden':continue
        source=by_name[node['name']]
        if source['appliedPhysicalChannels']!='upstream-estimates':raise ValueError('A diagnostic ablation is not a material acceptance')
        # The source has painted identity, but no measured pores or woven relief.
        # Apply the independent upstream estimates conservatively; do not add
        # invented scratches, dirt, cavities or geometry displacement.
        response={'normalScale':.05 if node['material'] in ('skin','hair') else .08,
                  'bumpScale':.00015 if node['material'] in ('skin','hair') else .0003,
                  'aoIntensity':.12,'status':'inferred physical response, not observed tactile detail'}
        responses[node['id']]=response
        node['surfaceDetail'].update(macroRoughness=.85,microRoughness=.02,bumpAmplitude=response['bumpScale'],
            normalPattern='Independent pinned reference-PBR normal field projected using the solved cameras',
            displacementPattern='None: preserve accepted geometry exactly',
            occlusionPattern='Independent pinned AO estimate, restricted by component source ownership',
            edgeWearPattern='None observed in the original flat-fill illustration',
            notes='Surface pass preserves source albedo/identity; normal/bump/AO strengths are explicit inferred presentation parameters. Inspect neutral and grazing-light captures.')
        evidence.append({'component':node['id'],'acceptedAlbedoSha256':sha256(w/source['files']['albedo']),
                         'upstreamPhysicalMapSha256':{k:sha256(w/source['files'][k]) for k in ('normal','height','ao','roughness')},
                         'response':response})
    spec['projectionBake']['surfaceResponses']=responses
    write_json(path,spec)
    write_json(w/'img2threejs/evidence/surface-authoring.json',{'status':'authored; actual render and review required','materialReview':review['id'],'sourceAlbedoChanged':False,'geometryChanged':False,'components':evidence})
    install=install_boundary(cache,cache/'host')
    return checked_run(install,w,'forge/stage2_spec/validate_sculpt_spec.py',['object-sculpt-spec.json','--strict-quality','--json'])

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);a=p.parse_args();raise SystemExit(author(a.workspace.resolve(),a.cache.resolve()))
