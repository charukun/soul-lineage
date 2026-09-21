"""Task-only bridge for user-approved conversation artwork; removed before merge.
Gap: Connector JSON cannot safely transfer multi-megabyte images.
Dependencies: expiring source URL, exact SHA, GitHub Actions token.
Detach after approved assets and provenance are committed.
"""
import os, json, urllib.request, hashlib, zipfile, io, base64
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
config=json.loads(Path('.storybook-task-input.json').read_text())
if config.get('mode')!='materialize':
    print('No materialization requested'); raise SystemExit(0)
source=urllib.request.urlopen(config['source'],timeout=60).read()
assert hashlib.sha256(source).hexdigest()==config['sha256'], 'SOURCE_HASH_MISMATCH'
z=zipfile.ZipFile(io.BytesIO(source)); manifest=json.loads(z.read('provenance.json'))
repo=os.environ['GITHUB_REPOSITORY']; head=os.environ['GITHUB_SHA']; branch='feat/rinne-approved-storybook-20260922'
def api(path, data=None, method=None):
    payload=None if data is None else json.dumps(data).encode()
    req=urllib.request.Request('https://api.github.com/repos/'+repo+'/'+path,data=payload,method=method or ('GET' if data is None else 'POST'),headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=60) as r:return json.load(r)
entries=[]
for name in z.namelist():
    if name.startswith('assets/'):
        dest='apps/rinne/public/ui/storybook/'+name.split('/',1)[1]
    elif name.startswith('references/'):
        dest='docs/rinne/ui-reference-v6/'+name.split('/',1)[1]
    elif name=='provenance.json':dest='apps/rinne/public/ui/storybook/provenance.json'
    else:continue
    entries.append((dest,z.read(name)))
def blob(row):
    path, content=row
    sha=api('git/blobs',{'content':base64.b64encode(content).decode(),'encoding':'base64'})['sha']
    return {'path':path,'mode':'100644','type':'blob','sha':sha}
with ThreadPoolExecutor(max_workers=5) as pool:rows=list(pool.map(blob,entries))
base=api('git/commits/'+head)['tree']['sha'];tree=api('git/trees',{'base_tree':base,'tree':rows})['sha']
commit=api('git/commits',{'message':'承認UI画像から抽出した装飾・原画とprovenanceをmaterialize','tree':tree,'parents':[head]})['sha']
assert api('git/ref/heads/'+branch)['object']['sha']==head,'WORK_BRANCH_MOVED'
api('git/refs/heads/'+branch,{'sha':commit,'force':False},method='PATCH')
Path('.storybook-evidence').mkdir(exist_ok=True)
receipt={'kind':'asset-materialization','sourceSha256':config['sha256'],'parent':head,'commit':commit,'files':len(rows),'provenance':manifest}
Path('.storybook-evidence/materialization.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2))
print(json.dumps({'materializedCommit':commit,'files':len(rows)},ensure_ascii=False))
