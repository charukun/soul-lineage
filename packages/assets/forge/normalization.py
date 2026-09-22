from PIL import Image
from common import evidence
from intake import foreground

SIZE=320
PAD=16
HEIGHT=SIZE-2*PAD

def normalize_views(views):
    output={}
    for name,source in views.items():
        image=source['image']; mask=foreground(image); bounds=mask.getbbox()
        if not bounds: raise ValueError('Empty foreground: '+name)
        l,t,r,b=bounds; height=b-t
        if height<32: raise ValueError('Character is too small: '+name)
        # Ground/height anchoring preserves aspect. We never stretch shoulder/face widths.
        scale=HEIGHT/height; width=max(1,round((r-l)*scale))
        if width>SIZE-8: raise ValueError('Full-body upright neutral reference required: '+name)
        cut=image.crop(bounds); cut.putalpha(mask.crop(bounds))
        normalized=Image.new('RGBA',(SIZE,SIZE),(0,0,0,0))
        normalized.alpha_composite(cut.resize((width,HEIGHT),Image.Resampling.LANCZOS),((SIZE-width)//2,PAD))
        nmask=normalized.getchannel('A').point(lambda a:255 if a>96 else 0)
        output[name]={**source,'normalized':normalized,'mask':nmask,
          'normalization':{'rawBounds':list(bounds),'rawSize':list(image.size),'uniformScale':scale,'groundPixel':SIZE-PAD,'centerPixel':SIZE/2,'characterHeightPixels':HEIGHT,'normalizedSize':[SIZE,SIZE],
            'perspectiveCompensation':{'method':'weak-perspective isotropic height/ground normalization','status':'inferred','fullPerspectiveSolved':False,'remaining':'Foreshortening and pose differences remain uncertain'}}}
    return output
