"""Create delivery textures only; never rewrite a model, buffer, or source image."""
import hashlib
import json
import pathlib
import sys
from PIL import Image

root = pathlib.Path(sys.argv[1]).resolve()
audit = json.loads((root / 'exclusion-audit.json').read_text())
output = root / 'delivery'
output.mkdir(exist_ok=True)
records = []
for source in audit['sourceFiles']:
    path = source['sourcePath']
    if pathlib.PurePosixPath(path).suffix.lower() not in ('.png', '.jpg', '.jpeg'):
        continue
    original = root / 'vendor' / path
    source_hash = hashlib.sha256(original.read_bytes()).hexdigest()
    if source_hash != source['sha256']:
        raise RuntimeError('Source image changed before delivery conversion: ' + path)
    dest = output / (source_hash[:24] + '.webp')
    with Image.open(original) as image:
        source_size = list(image.size)
        image = image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
        image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        image.save(dest, 'WEBP', quality=90, method=4)
        size = list(image.size)
    data = dest.read_bytes()
    records.append({'original': 'models/vendor/' + path,
                    'file': 'models/delivery/' + dest.name,
                    'originalSHA256': source_hash, 'sha256': hashlib.sha256(data).hexdigest(),
                    'sourceDimensions': source_size, 'dimensions': size,
                    'originalBytes': source['bytes'], 'bytes': len(data)})
report = {'version': 1, 'byOriginal': {r['original']: r['file'] for r in records},
          'textures': records, 'originalTextureBytes': sum(r['originalBytes'] for r in records),
          'deliveryTextureBytes': sum(r['bytes'] for r in records), 'geometryChanges': 0}
(root / 'delivery.json').write_text(json.dumps(report, indent=2) + '\n')
print('Texture delivery:', report['originalTextureBytes'], '->', report['deliveryTextureBytes'],
      'bytes;', len(records), 'textures; original model geometry untouched.')
