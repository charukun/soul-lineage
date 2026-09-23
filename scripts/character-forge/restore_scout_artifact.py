"""Materialize a hash-bound task artifact, not a replacement reconstruction."""
import hashlib,json,shutil,tarfile
from pathlib import Path
checkpoint=json.loads(Path('scripts/character-forge/fixtures/upstream-scout-checkpoint.json').read_text())
root=Path('.forge-resume')
archive=root/'evidence.tar.gz'
if hashlib.sha256(archive.read_bytes()).hexdigest()!=checkpoint['archiveSha256']:
    raise ValueError('Rejected reconstruction archive changed')
if (root/'source-sha.txt').read_text().strip()!=checkpoint['sourceHead']:
    raise ValueError('Unexpected reconstruction source head')
target=Path('test-results');target.mkdir(exist_ok=True)
if (target/'character-forge-upstream').exists():raise ValueError('Refuse to overwrite an existing workspace')
with tarfile.open(archive) as tar:tar.extractall(target,filter='data')
w=target/'character-forge-upstream/upstream-scout'
if hashlib.sha256((w/'build/material-pass.ts').read_bytes()).hexdigest()!=checkpoint['factorySha256']:
    raise ValueError('Upstream factory changed')
shutil.copytree(w/'review/material-pass',w/'review'/checkpoint['archiveReviewAs'])
print('Restored actual '+checkpoint['sourceHead']+' reconstruction; retained rejected material captures')
