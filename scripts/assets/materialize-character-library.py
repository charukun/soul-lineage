#!/usr/bin/env python3
"""Explicit character-intake adapter for the existing pinned materializer.

No independent HTTP client, credential handling, git writes or deployment.
Uses materialize-curation's integrity, glTF embedding and structural checks.
Preserves the existing catalog and emits additive review-only backing data.
"""
from __future__ import annotations
import datetime
import importlib.util
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
SPEC_PATH = ROOT / 'scripts/assets/quaternius-characters-20260922.json'
SPEC = json.loads(SPEC_PATH.read_text())
# The existing module reads its explicit spec at import; main is not invoked.
sys.argv = [sys.argv[0], str(SPEC_PATH)]
loader = importlib.util.spec_from_file_location('pinned_materializer', ROOT / 'scripts/assets/materialize-curation.py')
M = importlib.util.module_from_spec(loader)
loader.loader.exec_module(M)
LIBRARY = M.LIBRARY
OUT = ROOT / '.quaternius-intake'
OUT.mkdir(exist_ok=True)
GENERATED = ROOT / 'packages/assets/generated/quaternius-characters.json'
LEDGER = LIBRARY / 'provenance/quaternius-characters-20260922.json'
LABELS = {'Cleric':'神官', 'Monk':'武闘家', 'Ranger':'弓使い', 'Rogue':'盗賊', 'Warrior':'剣士', 'Wizard':'魔法使い', 'Medieval':'女冒険者', 'Witch':'魔女', 'King':'王'}

def require(condition, message):
    if not condition:
        raise ValueError(message)

def fingerprint(data):
    return {'sha256': M.sha256(data), 'gitBlobSha': M.blob_sha(data), 'byteLength': len(data)}

def write_asset(manifest, relative, data):
    M.write_new(LIBRARY / relative, data)
    M.add_manifest(manifest, relative, data)
    return relative

def main():
    require(SPEC['schema'] == 1 and SPEC['policy']['additiveOnly'], 'Additive explicit intake required')
    manifest = json.loads(M.MANIFEST_PATH.read_text())
    previous_manifest = {row['path']: dict(row) for row in manifest['files']}
    hash_paths = {row['gitBlobSha']: row['path'] for row in manifest['files']}
    tracked = subprocess.check_output(['git', 'ls-files', '--stage', '-z'], cwd=ROOT).decode().split('\0')
    tracked_models = []
    for line in tracked:
        if not line:
            continue
        metadata, path = line.split('\t', 1)
        if path.lower().endswith(('.glb', '.gltf')):
            tracked_models.append({'path': path, 'gitBlobSha': metadata.split()[1]})
    records, packs, held = [], [], []
    report = {'schema': 1, 'id': SPEC['id'], 'baseSha': SPEC['baseSha'], 'materializedOnHead': subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip(), 'acquiredAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'runtimeOrigin': manifest['origin'], 'status': 'MATERIALIZED_NOT_VISUALLY_APPROVED', 'packs': packs, 'files': records, 'held': held, 'duplicateAudit': {'trackedModelCount':len(tracked_models), 'existingManifestFiles':len(previous_manifest), 'matches':[]}, 'productionVisualApproval': False}
    for pack in SPEC['packs']:
        evidence = {'id':pack['id'], 'name':pack['name'], 'author':pack['author'], 'license':pack['license'], 'originalSource':pack['originalSource'], 'officialFolder':pack['officialFolder'], 'acquisitionRepository':pack['repository'], 'acquisitionRevision':pack['revision'], 'upstreamRevision':None, 'upstreamArchive':None, 'upstreamArchiveNote':'Author supplies individual files, not a published ZIP. Acquired input hashes and immutable mirror revisions pin the actual bytes.', 'excluded':[{'name':name,'reason':'modern/SF clothing or insufficiently clothed; author preview inspected; not relabeled as medieval'} for name in pack['excluded']]}
        packs.append(evidence)
        try:
            require(pack['license'] == 'CC0-1.0' and M.SHA_RE.fullmatch(pack['revision']), 'Uncleared or unpinned pack')
            require(pack['originalSource'].startswith('https://quaternius.com/packs/'), 'Official pack page required')
            page = M.request(pack['originalSource'], limit=1000000)
            require(b'creativecommons.org/publicdomain/zero/1.0' in page, 'Official pack page does not declare CC0')
            evidence['officialPageSha256'] = M.sha256(page)
            if pack.get('localLicense'):
                license_bytes = (ROOT / M.safe_path(pack['localLicense'])).read_bytes()
                require(M.sha256(license_bytes) == pack['licenseSha256'], 'Original included license bytes changed')
                license_source = {'url':pack['originalLicenseUrl'], 'acquisition':'connected Drive raw file; exact bytes preserved in repository', **fingerprint(license_bytes)}
            else:
                license_bytes, license_source = M.source_bytes(pack, pack['licensePath'])
                require(license_source['gitBlobSha'] == pack['licenseBlobSha'], 'Included license pin mismatch')
            require(b'CC0 1.0 Universal' in license_bytes and b'creativecommons.org/publicdomain/zero/1.0/' in license_bytes, 'Included CC0 declaration missing')
            require(not re.search(rb'Quaternius Asset License|\bQAL\b|not redistribute', license_bytes, re.I), 'Conflicting included license')
            license_path = write_asset(manifest, 'licenses/'+pack['id']+'-CC0.txt', license_bytes)
            evidence['includedLicense'] = {**license_source, 'originalUrl':pack['originalLicenseUrl'], 'runtimePath':license_path, 'note':pack.get('licenseNote')}
            for name in pack['models']:
                try:
                    source_path = pack['sourcePrefix']+name+'.gltf'
                    source_bytes, source = M.source_bytes(pack, source_path)
                    direct = pack.get('verifiedOriginals', {}).get(name)
                    if direct:
                        require(source['sha256'] == direct['sha256'] and source['byteLength'] == direct['byteLength'], 'Mirror differs from directly acquired original: '+name)
                    inputs = [source]
                    output = M.embed_gltf(pack, source_path, source_bytes, inputs)
                    inspection = M.inspect_glb(output, 'creature')
                    require(len(output) <= SPEC['policy']['maxCreatureBytes'], 'Character byte budget exceeded')
                    doc, binary = M.read_glb(output)
                    joints = sorted({j for skin in doc.get('skins',[]) for j in skin['joints']})
                    native_clips = [clip['name'] for clip in inspection['animations']]
                    require(any(re.search('idle',clip,re.I) for clip in native_clips), 'Native idle required')
                    require(any(re.search('walk|run',clip,re.I) for clip in native_clips), 'Native locomotion required')
                    require(any(re.search('attack|slash|punch|spell|kick',clip,re.I) for clip in native_clips), 'Native combat action required')
                    output_hash = M.blob_sha(output)
                    existing_path = hash_paths.get(output_hash)
                    identity = pack['id']+'-'+M.slug(name)
                    relative = existing_path or 'model/'+pack['id']+'/'+M.slug(name)+'/'+output_hash+'.glb'
                    write_asset(manifest, relative, output)
                    input_matches = [row for row in tracked_models if row['gitBlobSha'] in (source['gitBlobSha'],output_hash)]
                    if input_matches or existing_path:
                        report['duplicateAudit']['matches'].append({'id':identity,'existingRuntimePath':existing_path,'tracked':input_matches})
                    rig = {'id':pack['id']+'.native', 'jointCount':len(joints), 'nodes':[{'index':j,'name':doc['nodes'][j].get('name'),'children':doc['nodes'][j].get('children',[])} for j in joints], 'kaykitCompatibility':'not asserted', 'retargeted':False}
                    inspection.update({'uniqueBoneCount':len(joints), 'morphTargets':sum(len(p.get('targets',[])) for mesh in doc.get('meshes',[]) for p in mesh['primitives']), 'meshParts':[mesh.get('name') for mesh in doc.get('meshes',[])], 'materialNames':[material.get('name') for material in doc.get('materials',[])], 'scaleOrientationFeet':'glTF authored transforms preserved; viewer normalization and ground contact require browser review'})
                    record = {'id':identity, 'modelId':'character.'+identity+'.v1', 'visualAssetId':'library.'+identity+'.v1', 'label':LABELS[name]+' · '+name, 'modelName':name, 'kind':'character', 'type':'character', 'category':'characters', 'active':False, 'status':'MATERIALIZED', 'origin':'artist-authored', 'license':pack['license'], 'author':pack['author'], 'originalSource':pack['originalSource'], 'pack':pack['id'], 'runtimePath':relative, 'localPath':'apps/review/public/library/'+relative, 'licensePath':'apps/review/public/library/'+license_path, **fingerprint(output), 'source':{'repository':pack['repository'],'revision':pack['revision'],**source,'hash':'git-blob:'+source['gitBlobSha']}, 'originalFileUrl':'https://drive.google.com/file/d/'+pack['originalFileIds'][name]+'/view', 'directOriginalByteComparison':bool(direct), 'inputs':inputs, 'transform':'Existing materialize-curation glTF-to-GLB embedding only; authored geometry, materials, rig and clips unchanged; no decimation or retargeting', 'inspection':inspection, 'rig':rig, 'availableReviewClips':[clip for clip in native_clips if not re.search('gun|shoot',clip,re.I)], 'uses':['female-protagonist-comparison','combat-profession'] if pack['id'].endswith('women') else ['combat-profession','npc-comparison'], 'registrationKind':'existing-materialized-content' if existing_path else 'new-model', 'review':{'route':'/review-objects','nativeAnimationOnly':True,'productionVisualApproval':False,'runtimeApproval':False,'browserStatus':'pending'}}
                    records.append(record)
                    hash_paths[output_hash] = relative
                    original_path = OUT/'originals'/pack['id']/(name+'.gltf')
                    original_path.parent.mkdir(parents=True,exist_ok=True)
                    original_path.write_bytes(source_bytes)
                    print(json.dumps({'id':identity,'bytes':len(output),'triangles':inspection['triangles'],'bones':len(joints),'clips':len(native_clips),'registration':record['registrationKind']}),flush=True)
                except Exception as error:
                    held.append({'pack':pack['id'],'model':name,'reason':str(error)})
        except Exception as error:
            held.append({'pack':pack['id'],'reason':str(error)})
    require(len({record['id'] for record in records}) == len(records), 'Duplicate model IDs')
    require(len({record['sha256'] for record in records}) == len(records), 'Duplicate model bytes')
    after = {row['path']:row for row in manifest['files']}
    require(all(after.get(key) == value for key,value in previous_manifest.items()), 'Existing Asset Origin manifest modified')
    manifest['files'].sort(key=lambda row:row['path'])
    M.write_json(M.MANIFEST_PATH, manifest)
    M.write_json(LEDGER, report)
    M.write_json(GENERATED, records)
    M.write_json(OUT/'materialization.json', report)
    require(bool(records), 'No eligible characters materialized; inspect per-pack holds')

if __name__ == '__main__':
    main()
