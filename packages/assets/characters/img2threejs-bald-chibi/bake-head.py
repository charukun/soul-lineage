"""Bake the img2threejs de-lit front reference onto a sphere's UVs.

Run: python3 bake-head.py reference-delit.png head-uv.png
Uses Pillow for image I/O; the reconstruction geometry remains Three.js code.
The unseen hemisphere is explicitly inferred as a uniform skin palette.
"""
import math
import sys
from PIL import Image

source = Image.open(sys.argv[1]).convert('RGB')
size = 1024
out = Image.new('RGB', (size, size), (250, 219, 220))
pixels = out.load()
for j in range(size):
    # THREE.SphereGeometry: v=1 at the crown; front longitude u=.25.
    v = 1 - (j + .5) / size
    y = 2 * v - 1
    for i in range(size):
        u = (i + .5) / size
        longitude = 2 * math.pi * u
        x = -math.cos(longitude) * math.sqrt(max(0, 1 - y * y))
        z = math.sin(longitude) * math.sqrt(max(0, 1 - y * y))
        if z <= .1:
            continue
        sx = max(0, min(source.width - 1, round(508 + x * 248)))
        sy = max(0, min(source.height - 1, round(294 - y * 260)))
        observed = source.getpixel((sx, sy))
        inferred = (250, 219, 220)
        weight = min(1, max(0, (z - .1) / .38))
        pixels[i, j] = tuple(round(a * weight + b * (1 - weight)) for a, b in zip(observed, inferred))
out.save(sys.argv[2], optimize=True)
