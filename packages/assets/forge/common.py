"""RINNE-owned deterministic candidate builder. No upstream implementation copied."""
import hashlib
import json
import math
from pathlib import Path

VERSION = '1.0.0'
VIEWS = ('front', 'front34', 'side', 'back34', 'back')
ANGLES = dict(zip(VIEWS, (0, math.pi/4, math.pi/2, 3*math.pi/4, math.pi)))

def digest(data):
    return hashlib.sha256(data).hexdigest()

def save_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)+'\n')

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def median(values):
    a = sorted(values)
    return a[len(a)//2]

def evidence(value, status, views, method):
    return dict(value=value, status=status, views=views, method=method)
