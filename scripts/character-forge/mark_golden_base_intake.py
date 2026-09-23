"""Record only completed Golden Base intake tasks in the actual upstream state.

No specimen geometry, comparison, visual approval or pass is marked here.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'packages/assets/forge'))
from upstream_workspace import checked_run, install_boundary, write_json


def mark(w: Path, cache: Path) -> dict:
    job = json.loads((w/'forge-job.json').read_text())
    if job['id'] != 'golden-base-v1':
        raise ValueError('The state is not the real supplied Golden Base reference')
    install = install_boundary(cache, cache/'host')
    measured = json.loads((w/'img2threejs/evidence/landmarks.json').read_text())
    admissions = {v: json.loads((w/f'img2threejs/evidence/{v}-admission.json').read_text())
                  for v in ('front','side','back')}
    if not all(row['admitted'] for row in admissions.values()):
        raise ValueError('All supplied views must pass actual pinned admission')
    if len({row['provenance']['pHash'] for row in admissions.values()}) != 3:
        raise ValueError('A supplied view duplicates another view')
    contracts = ('grimoire/intake/image_analysis.md', 'grimoire/intake/validation_rubric.md',
                 'grimoire/character/reconstruction.md', 'grimoire/character/likeness_maximization.md',
                 'grimoire/character/structure_decomposition.md', 'grimoire/character/head_construction.md',
                 'grimoire/character/stylized_hair_threejs.md')
    if any(not (install['engine']/name).is_file() for name in contracts):
        raise ValueError('A pinned character contract cannot be read')
    notes = {'author': 'Codex inspected the actual Golden Base reference',
             'suitability': 'conditional: illustrated three-view character with full front/side/back; inconsistent arm presentation and printed head ratio are recorded',
             'observed': [
                 'Large bald cranium and rounded ear visible from Front, Side and Back; real Side nose, jaw and occiput profile.',
                 'Mint eyes, curved brows, tiny nose and mouth distinguish the Front face and require projected source pixels.',
                 'Gray sleeveless bodysuit, bare arms/legs/feet; no hair on this base-model subject.',
                 'Front/Back wide approximately T-pose versus lowered arm in Side; treat pose mismatch as uncertainty, not a depth measurement.',
                 'Visible full height about 668 source pixels and head about 263; printed ratio ~3.5 conflicts with pixel estimate ~2.54.'
             ],
             'inferred': ['Internal facial depth and joint locations', 'Side/back surface behind occlusions',
                          'Absolute 1.6m scale for game runtime', 'Eye and mouth expression poses'],
             'materials': {'skin': 'pale pink matte with illustrated face shading',
                           'bodysuit': 'neutral gray matte', 'eyes': 'mint translucent/glossy appearance, physical parameters inferred'},
             'construction': ['Separate head/jaw/cheek/nose/ear components before surface projection',
                              'Front/Side silhouette cone intersection is an upper constraint; Back supplies surface evidence',
                              'No Scout hair, tunic, belt, boots or blue-back palette belongs to this subject'],
             'contracts': list(contracts),
             'notAccepted': ['Shape likeness', 'Projected material', 'Rig', 'Animation', 'native Lab']}
    write_json(w/'img2threejs/evidence/author-intake-review.json', notes)
    hits=[]
    for rel in contracts[2:6]:
        for number,line in enumerate((install['engine']/rel).read_text().splitlines(),1):
            if any(q in line.lower() for q in ('landmark','projection','profile','proportion')):
                hits.append({'file':rel,'line':number,'text':line[:500]})
    write_json(w/'img2threejs/evidence/local-spec-search.json',
               {'method':'read-only search of exact pinned reconstruction/likeness/structure/head contracts',
                'query':'stylized head profile and eye placement, landmark, projection, proportions',
                'matches':hits})
    links = [('image-analysis','img2threejs/evidence/author-intake-review.json'),
             ('reference-suitability','img2threejs/evidence/author-intake-review.json'),
             ('reference-admission','img2threejs/evidence/intake-summary.json'),
             ('character-contract-read','img2threejs/evidence/author-intake-review.json'),
             ('character-landmarks','img2threejs/evidence/landmarks.json'),
             ('local-spec-search','img2threejs/evidence/local-spec-search.json')]
    state_path = w/'.img2threejs/state.json'
    for step,evidence in links:
        state=json.loads(state_path.read_text())
        row=next(item for item in state['checklist'] if item['id']==step)
        if row['status']=='done':
            continue
        if state['currentStep']!=step or not (w/evidence).is_file():
            raise ValueError('Pinned state order/evidence differs at '+step)
        if checked_run(install,w,'forge/state.py',
                       ['mark',step,'--state','.img2threejs/state.json','--evidence',evidence]):
            raise ValueError('Pinned state refused the actual completed intake task '+step)
    if checked_run(install,w,'forge/next.py',['--state','.img2threejs/state.json']):
        raise ValueError('Pinned next gate rejected Golden Base intake')
    state=json.loads(state_path.read_text())
    if state['currentStep']!='pre-spec-assessment' or state['currentPass']:
        raise ValueError('Intake did not reach the proper pre-spec step')
    return {'status':state['status'],'currentStep':state['currentStep'],
            'currentPass':state['currentPass'],'observedHeadUnits':
            (measured['feetRow']-measured['crownRow'])/measured['headHeightPixels']}


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--workspace',type=Path,required=True)
    p.add_argument('--cache',type=Path,default=ROOT/'.cache/character-forge-upstream')
    a=p.parse_args()
    print(json.dumps(mark(a.workspace.resolve(),a.cache.resolve())))
