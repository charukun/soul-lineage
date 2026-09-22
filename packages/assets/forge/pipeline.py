"""Fifteen explicit stages; immutable inputs + replayable spec + fail-closed registration."""
import argparse
import json
import re
import shutil
import sys
import tempfile
from pathlib import Path
from common import VERSION,VIEWS,digest,save_json
from intake import intake
from detection import detect_views
from normalization import normalize_views
from measurement import measure_views
from specification import reconstruction_spec
from geometry import generate_geometry
from projection import project_textures
from rigging import create_rig
from skinning import skin_meshes
from animation import create_animations
from sockets import create_sockets
from exporter import export_glb
from validation import validate_export
from registration import create_manifest,register_review

STAGES=['Intake','View Detection','View Normalization','Multi-view Measurement','Reconstruction Spec','Geometry Generation','Multi-view Texture Projection','Rig','Skinning','Animation','Socket Generation','Export','Validation','Character Package Registration','Visual Review Lab Registration']

def run(options):
    if not re.fullmatch('[a-z0-9][a-z0-9-]{0,63}',options.id):raise ValueError('Invalid character id')
    root=Path(options.root).resolve();target=root/'packages/assets/characters/forge'/options.id
    if target.exists() and not options.replace:raise ValueError('Package exists; use --replace after checking existing approval')
    if target.exists() and json.loads((target/'manifest.json').read_text()).get('reviewStatus')=='approved':raise ValueError('Approved package is immutable; use a new id')
    provenance=json.loads(Path(options.provenance).read_text())
    if provenance.get('license') not in ('RINNE-OWNED','CC0-1.0') or not provenance.get('author') or not provenance.get('source'):
        raise ValueError('Source provenance must identify author/source and eligible RINNE-OWNED or CC0-1.0 rights')
    target.parent.mkdir(parents=True,exist_ok=True);temp=Path(tempfile.mkdtemp(prefix=options.id+'-',dir=target.parent));history=[]
    def stage(name):history.append({'stage':name,'status':'completed'});save_json(temp/'pipeline-state.json',{'forgeVersion':VERSION,'stages':history})
    try:
        sources=intake(options);stage(STAGES[0]);views,detected=detect_views(sources,options.sheet_order);stage(STAGES[1])
        (temp/'source').mkdir();(temp/'review/references').mkdir(parents=True)
        for name,source in sources.items():
            suffix=Path(source['filename']).suffix.lower();(temp/'source'/('original-'+name+suffix)).write_bytes(source['raw'])
        for name,view in views.items():
            path=temp/'source'/(name+'.png');view['image'].save(path);view['parentSha256']=view['sha256'];view['sha256']=digest(path.read_bytes())
        views=normalize_views(views);stage(STAGES[2])
        for name,v in views.items():v['normalized'].save(temp/'review/references'/(name+'.png'))
        measured=measure_views(views);stage(STAGES[3])
        analysis=json.loads(Path(options.analysis).read_text()) if options.analysis else None
        spec=reconstruction_spec(options.id,options.name,views,measured,detected,{**provenance,'generator':'RINNE-owned procedural pipeline','sourceHashes':{v:s['sha256'] for v,s in sources.items()}},analysis);stage(STAGES[4])
        geometry=generate_geometry(spec);stage(STAGES[5])
        projection=project_textures(spec,views,geometry,temp/'build/textures');spec['textureProjection']=projection;stage(STAGES[6])
        bones=create_rig(spec);stage(STAGES[7]);skin_meshes(geometry,bones);stage(STAGES[8]);clips=create_animations(bones);stage(STAGES[9]);create_sockets(spec);stage(STAGES[10])
        model=temp/'build/character.glb';export_glb(spec,geometry,bones,clips,temp/'build/textures/base-color.png',model);stage(STAGES[11])
        report=validate_export(spec,views,model,projection,temp/'review/comparisons');save_json(temp/'validation-report.json',report);stage(STAGES[12])
        if report['errors']:raise ValueError('; '.join(report['errors']))
        save_json(temp/'spec/reconstruction.json',spec);manifest=create_manifest(spec,report,clips,model);save_json(temp/'manifest.json',manifest)
        views['front']['normalized'].save(temp/'review/thumbnail.png');stage(STAGES[13])
        backup=target.with_name(target.name+'.previous')
        if backup.exists():raise ValueError('Recovery directory already exists; inspect before replacing')
        if target.exists():target.rename(backup)
        temp.rename(target)
        try: count=register_review(root)
        except Exception:
            target.rename(temp)
            if backup.exists():backup.rename(target)
            raise
        if backup.exists():shutil.rmtree(backup)
        history.append({'stage':STAGES[14],'status':'completed'});save_json(target/'pipeline-state.json',{'forgeVersion':VERSION,'stages':history,'registeredPackages':count})
        return {'id':options.id,'path':str(target),'mode':spec['reconstructionMode'],'reviewStatus':'review-candidate','performance':report['performance'],'comparisons':report['comparisons']}
    except Exception as error:
        save_json(temp/'failure.json',{'error':str(error),'completedStages':history});raise

def parser():
    p=argparse.ArgumentParser(description='Character Create Forge: three-view recommended; single-view fallback')
    for view in VIEWS:p.add_argument('--'+view)
    p.add_argument('--sheet');p.add_argument('--sheet-order',help='Astra semantic labels only, never pixel coordinates')
    p.add_argument('--analysis',help='Optional Astra semantic parts JSON; not a user coordinate UI')
    p.add_argument('--id',required=True);p.add_argument('--name',required=True);p.add_argument('--provenance',required=True)
    p.add_argument('--replace',action='store_true');p.add_argument('--root',default=str(Path(__file__).resolve().parents[3]))
    return p

if __name__=='__main__':
    try: print(json.dumps(run(parser().parse_args()),ensure_ascii=False))
    except Exception as error:print(str(error),file=sys.stderr);sys.exit(1)
