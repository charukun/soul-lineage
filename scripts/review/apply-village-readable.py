"""Apply inert UTF-8 splices to the isolated feature checkout, fail closed on drift."""
import hashlib
import json
import pathlib
import re
import sys

source = pathlib.Path(sys.argv[1]).resolve()
root = pathlib.Path(sys.argv[2]).resolve()
output = pathlib.Path(sys.argv[3]).resolve()
output.mkdir(parents=True, exist_ok=True)
sha = lambda data: hashlib.sha256(data).hexdigest()
files = []
seen = set()
for number in range(1, 7):
    path = source / f'repair-readable-{number}.txt'
    data = path.read_text(encoding='utf-8')
    assert data.startswith('MURA-PATCH/1\n'), str(path)
    cursor = len('MURA-PATCH/1\n')
    def line():
        global cursor
        while cursor < len(data):
            end = data.find('\n', cursor)
            assert end >= 0, f'Unterminated header: {path}:{cursor}'
            value = data[cursor:end]
            cursor = end + 1
            if value:
                return value
        return None
    while True:
        header = line()
        if header is None:
            break
        parts = header.split()
        assert len(parts) == 5 and parts[0] == 'FILE', f'Invalid file header: {path}:{cursor}: {header[:100]}'
        _, name, before, after, count = parts
        rel = pathlib.PurePosixPath(name)
        assert not rel.is_absolute() and '..' not in rel.parts
        assert name.startswith('apps/village/') or name == 'scripts/browser/pr-smoke.mjs'
        assert name not in seen, name
        seen.add(name)
        target = root / name
        assert all(not p.is_symlink() for p in [target, *target.parents]), name
        assert before == '-' or re.fullmatch('[0-9a-f]{64}', before)
        assert after == '-' or re.fullmatch('[0-9a-f]{64}', after)
        original = target.read_bytes() if target.exists() else None
        assert (sha(original) if original is not None else '-') == before, f'Base changed; do not overwrite: {name}'
        old_lines = original.decode('utf-8').splitlines(keepends=True) if original is not None else []
        edits = []
        previous_end = 0
        for index in range(int(count)):
            edit_header = line()
            parts = edit_header.split() if edit_header else []
            assert len(parts) == 4 and parts[0] == 'EDIT', f'Invalid edit {name} #{index}: {edit_header}'
            start, end, length = map(int, parts[1:])
            assert 0 <= previous_end <= start <= end <= len(old_lines)
            assert 0 <= length <= 100000
            previous_end = end
            text = data[cursor:cursor + length]
            assert len(text) == length
            cursor += length
            assert cursor < len(data) and data[cursor] == '\n', f'Edit delimiter mismatch: {name} #{index} offset {cursor}'
            cursor += 1
            edits.append((start, end, text))
        if after == '-':
            assert not edits and original is not None
            content = None
        else:
            lines = old_lines.copy()
            for start, end, text in reversed(edits):
                lines[start:end] = [text]
            content = ''.join(lines).encode('utf-8')
            actual = sha(content)
            assert actual == after, f'Transfer checksum mismatch: {name}; expected {after}, got {actual}'
        files.append((name, before, after, content))
        print('VERIFIED', name, flush=True)
assert len(files) == 29, len(files)
# Nothing is written until every path, base file and resulting file validates.
for name, before, after, content in files:
    target = root / name
    if content is None:
        target.unlink()
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
manifest = [{'path': name, 'before': before, 'after': after} for name, before, after, _ in files]
(output / 'verified-files.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
(output / 'paths.txt').write_text('\n'.join(name for name, _, _, _ in files) + '\n', encoding='utf-8')
print('VERIFIED_AND_APPLIED', len(files), flush=True)
