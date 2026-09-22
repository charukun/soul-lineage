from pathlib import Path
from PIL import Image, ImageChops, ImageStat
from common import digest, median

MAX_PIXELS = 24_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS

def read_image(path):
    path = Path(path)
    raw = path.read_bytes()
    if len(raw) > 32_000_000:
        raise ValueError('Source exceeds 32 MB')
    with Image.open(path) as source:
        if source.width*source.height > MAX_PIXELS:
            raise ValueError('Source exceeds 24 million pixels')
        image = source.convert('RGBA')
    return dict(image=image, raw=raw, sha256=digest(raw), filename=path.name)

def foreground(image):
    """Flat-background/transparent-sheet intake, not semantic human segmentation."""
    alpha = image.getchannel('A')
    if alpha.getextrema()[0] < 32:
        return alpha.point(lambda v: 255 if v > 32 else 0)
    w,h = image.size
    corners = [image.getpixel(p) for p in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]]
    bg = tuple(median([c[i] for c in corners]) for i in range(3))
    diff = ImageChops.difference(image.convert('RGB'), Image.new('RGB', image.size, bg))
    r,g,b = diff.split()
    return ImageChops.lighter(ImageChops.lighter(r,g),b).point(lambda v: 255 if v > 28 else 0)

def intake(options):
    paths = {v: getattr(options,v,None) for v in ('front','front34','side','back34','back')}
    if options.sheet and any(paths.values()):
        raise ValueError('Use sheet or individual views, not both')
    sources = {v: read_image(p) for v,p in paths.items() if p}
    if options.sheet:
        sources['sheet'] = read_image(options.sheet)
    if not sources:
        raise ValueError('A front image or sheet is required')
    return sources
