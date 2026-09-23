"""Record completed Scout setup steps through upstream state, with real artifacts.
No visual pass is approved by this script.
"""
import argparse,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import install_boundary,checked_run,write_json

def setup(w,cache):
    install=install_boundary(cache,cache/'host')
    def run(entry,*args):
        code=checked_run(install,w,entry,list(args))
        if code:raise RuntimeError(f'{entry} failed: {code}')
    notes={'author':'Codex source-image review','suitability':'character-conditional: maximum likeness to the original illustrated Scout; hidden depth inferred','analysis':[
      'One full-body humanoid in each distinct front/side/back image; original fixture ownership recorded.',
      '316px full height / 77px head = 4.104 head units; arms down, feet separated. Side has a real nose profile and long foot.',
      'Separate cranium/face blend, hair shell, neck, torso/pelvis, upper/forearms/hands, trousers and boots.',
      'Observed dark fringe, eyes, mouth, teal front, blue back, gold belt and rear diamond must survive projection.',
      'Material identities are author-inferred intent. Automatic pixel class confidence remains 0.6 and is not claimed approved; registry material intent and PBR evidence are separate.',
      'Front/side hull is a silhouette constraint; back is not an independent third axis. Unseen cavities and opposite-side details are inferred/mirrored.',
      'Rig binding must follow accepted geometry and freeze/parity; no rig or visual acceptance yet.'
    ],'contracts':['grimoire/intake/image_analysis.md','grimoire/intake/validation_rubric.md','grimoire/character/reconstruction.md','grimoire/character/likeness_maximization.md','grimoire/character/structure_decomposition.md','grimoire/character/head_construction.md','grimoire/character/stylized_hair.md']}
    write_json(w/'img2threejs/evidence/author-intake-review.json',notes)
    # Local source search is read-only: retain concrete source matches without
    # writing an index/cache into the immutable upstream distribution.
    matches=[]
    for rel in ('grimoire/character/reconstruction.md','grimoire/character/likeness_maximization.md','grimoire/character/head_construction.md'):
        for n,line in enumerate((install['engine']/rel).read_text().splitlines(),1):
            if any(q in line.lower() for q in ('projection','proportion','landmark','head unit')):matches.append({'file':rel,'line':n,'text':line})
    write_json(w/'img2threejs/evidence/local-spec-search.json',{'query':'character head proportions landmarks projection','method':'read-only local source text search','matches':matches})
    run('forge/stage2_spec/new_pre_spec_assessment.py','Upstream Scout','--image','source/front.png','--out','img2threejs/evidence/assessment-scaffold.json','--character','--domain','animated-character','--force')
    run('forge/stage1_intake/build_detail_inventory.py','source/front.png','--mode','grid-3x3','--out-dir','img2threejs/evidence/detail-zones','--out','img2threejs/evidence/detail-scaffold.json','--force')
    cameras=json.loads((w/'img2threejs/evidence/cameras.json').read_text())
    for view,camera in cameras.items():
        write_json(w/f'img2threejs/evidence/{view}-camera.json',camera)
        run('forge/stage3_build/bake_projected_texture.py','--reference-image',f'source/{view}.png','--delit-image',f'build/textures/{view}-albedo.png','--camera',f'img2threejs/evidence/{view}-camera.json','--mesh-id','upstream-scout','--out',f'img2threejs/evidence/{view}-projection-plan.json')
    run('forge/stage2_spec/validate_sculpt_spec.py','object-sculpt-spec.json','--strict-quality','--json')
    links=[('image-analysis','img2threejs/evidence/author-intake-review.json'),('reference-suitability','img2threejs/evidence/author-intake-review.json'),('reference-admission','img2threejs/evidence/intake-summary.json'),('character-contract-read','img2threejs/evidence/author-intake-review.json'),('character-landmarks','img2threejs/evidence/landmarks.json'),('local-spec-search','img2threejs/evidence/local-spec-search.json'),('pre-spec-assessment','assessment.json'),('detail-inventory','assessment.json'),('projection-route','img2threejs/evidence/front-projection-plan.json'),('spec-authoring','object-sculpt-spec.json'),('material-evidence','img2threejs/evidence/material-summary.json'),('material-spec-wiring','object-sculpt-spec.json'),('strict-validation','img2threejs/commands')]
    state=json.loads((w/'.img2threejs/state.json').read_text())
    for step,evidence in links:
        row=next(v for v in state['checklist'] if v['id']==step)
        if row['status']=='done':continue
        if not (w/evidence).exists():raise RuntimeError(f'Missing evidence {evidence}')
        run('forge/state.py','mark',step,'--state','.img2threejs/state.json','--evidence',evidence)
    run('forge/next.py','--state','.img2threejs/state.json')
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);a=p.parse_args();setup(a.workspace.resolve(),a.cache.resolve())
