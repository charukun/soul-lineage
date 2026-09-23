"""Materialize a hash-bound task artifact, not a replacement reconstruction."""
import hashlib,json,shutil,tarfile
from pathlib import Path
root=Path('.forge-resume')
archive=root/'evidence.tar.gz'
if hashlib.sha256(archive.read_bytes()).hexdigest()!='3c2217574d51b1d7bd305b419c8770aede0f800de3e43c6ee5b415897d69cd68':
    raise ValueError('Rejected reconstruction archive changed')
if (root/'source-sha.txt').read_text().strip()!='ce6b54e9cb5c5e1487d82cf27994e4616ff52f3e':
    raise ValueError('Unexpected reconstruction source head')
target=Path('test-results');target.mkdir(exist_ok=True)
if (target/'character-forge-upstream').exists():raise ValueError('Refuse to overwrite an existing workspace')
with tarfile.open(archive) as tar:tar.extractall(target,filter='data')
w=target/'character-forge-upstream/upstream-scout'
if hashlib.sha256((w/'build/material-pass.ts').read_bytes()).hexdigest()!='493c298be84a847c0e8ba643bb1435d0e593a0a0e6194962efcd42d1c18fa274':
    raise ValueError('Upstream factory changed')
shutil.copytree(w/'review/material-pass',w/'review/material-r2-rejected')
print('Restored actual ce6 reconstruction; retained rejected material captures')
