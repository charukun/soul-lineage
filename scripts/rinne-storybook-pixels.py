"""Task-scoped reference metric; real text differs with actual game-state data."""
import sys
from PIL import Image, ImageFilter, ImageChops, ImageStat
reference=Image.open(sys.argv[1]).convert('RGB').resize((128,228)).filter(ImageFilter.GaussianBlur(2))
rendered=Image.open(sys.argv[2]).convert('RGB').resize((128,228)).filter(ImageFilter.GaussianBlur(2))
print(sum(ImageStat.Stat(ImageChops.difference(reference,rendered)).mean)/(3*255))
