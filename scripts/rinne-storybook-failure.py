"""Preserve generated diagnostics for this explicit authoring task only."""
from pathlib import Path
import os,json,base64,urllib.request
root=Path('.storybook-evidence')
files=list(root.glob('*.json'))+list(root.glob('initial-*.png'))
if not files:raise SystemExit(0)
repo=os.environ['GITHUB_REPOSITORY'];head=os.environ['GITHUB_SHA'];branch='feat/rinne-approved-storybook-20260922'
def api(path,data=None,method=None):
    req=urllib.request.Request('https://api.github.com/repos/'+repo+'/'+path,data=None if data is None else json.dumps(data).encode(),method=method or ('GET' if data is None else 'POST'),headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Content-Type':'application/json','Accept':'application/vnd.github+json'})
    with urllib.request.urlopen(req)as r:return json.load(r)
if api('git/ref/heads/'+branch)['object']['sha']!=head:raise SystemExit(0)
rows=[]
for p in files:
    sha=api('git/blobs',{'encoding':'base64','content':base64.b64encode(p.read_bytes()).decode()})['sha']
    rows.append({'path':'docs/rinne/ui-reference-v6/diagnostics/'+p.name,'mode':'100644','type':'blob','sha':sha})
tree=api('git/trees',{'base_tree':api('git/commits/'+head)['tree']['sha'],'tree':rows})['sha']
commit=api('git/commits',{'message':'比較作業の失敗診断を保存（検証成功ではない）','tree':tree,'parents':[head]})['sha']
api('git/refs/heads/'+branch,{'sha':commit,'force':False},'PATCH')
print(json.dumps({'diagnosticCommit':commit,'validation':'failed'}))
