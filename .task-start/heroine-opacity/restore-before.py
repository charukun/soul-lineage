"""Restore completed immutable Before, not a mutable DEV image or claimed success."""
import hashlib, io, json, os, urllib.request, zipfile
from pathlib import Path
artifact = 10691889355
req = urllib.request.Request(f'https://api.github.com/repos/charukun/soul-lineage/actions/artifacts/{artifact}/zip', headers={'Accept': 'application/vnd.github+json'})
# The storage URL carries its own signed authorization. Do not forward a
# GitHub bearer credential to that different host; it rejects that header.
req.add_unredirected_header('Authorization', 'Bearer '+os.environ['GH_TOKEN'])
with urllib.request.urlopen(req, timeout=180) as response: body = response.read()
assert hashlib.sha256(body).hexdigest() == '941c35e55ce655869a1b95d4b01513db4bb0e958b949084fc7e4bb1729dec402'
out = Path('generated/heroine-opacity'); out.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(io.BytesIO(body)) as archive:
    for entry in archive.infolist():
        if not entry.filename.startswith('before/'): continue
        path = (out/entry.filename).resolve(); assert path.is_relative_to(out.resolve()); path.parent.mkdir(parents=True,exist_ok=True)
        if not entry.is_dir(): path.write_bytes(archive.read(entry))
p = out/'before/receipt.json'; receipt=json.loads(p.read_text()); assert receipt['sourceSha']=='fa6b6b65dd015f5a5ef8c823aa6a7f2793de761d'
assert receipt['modelSha256']=='777f0c4f7f910edf85ab66011fddf961b7144a4a129212cf8a0b5a1b73937678'
assert receipt['errors']==[] and len(receipt['opacityReview']['matrix'])==80 and len(receipt['opacityReview']['playback'])==4
receipt['originalCaptureRun']='https://github.com/charukun/soul-lineage/actions/runs/35721432986'; receipt['originalCaptureArtifact']=artifact
p.write_text(json.dumps(receipt,indent=2)+'\n');print('Verified immutable completed Before:',receipt['sourceSha'],receipt['modelSha256'])
