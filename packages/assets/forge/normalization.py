from PIL import Image
from common import evidence,median
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
    # Align an independently estimated neck landmark across views in addition to
    # top/sole. Keep the pre-correction measurement and classify anatomical identity
    # as inferred; image evidence is never silently promoted to a known joint.
    necks={}
    for name,v in output.items():
        candidates=[]
        for y in range(round(SIZE-PAD-.88*HEIGHT),round(SIZE-PAD-.65*HEIGHT)):
            xs=[x for x in range(SIZE) if v['mask'].getpixel((x,y))]
            if xs:candidates.append((max(xs)-min(xs),y))
        necks[name]=min(candidates)[1] if candidates else round(SIZE-PAD-.76*HEIGHT)
    common=median(list(necks.values()))
    for name,v in output.items():
        raw=necks[name];delta=max(-HEIGHT*.035,min(HEIGHT*.035,common-raw))
        corrected=raw+delta
        v['normalization']['landmarkCorrection']={'neckRawNormalizedY':(SIZE-PAD-raw)/HEIGHT,'neckCorrectedNormalizedY':(SIZE-PAD-corrected)/HEIGHT,'medianNeckPixel':common,'shiftPixels':delta,'status':'inferred','method':'bounded piecewise vertical registration around independent silhouette neck minima; endpoints anchored','maxHeightFraction':.035}
        v['normalization']['landmarks']={key:{'rawNormalizedY':y,'normalizedY':y,'status':'inferred'} for key,y in {'chin':.79,'shoulder':.71,'chest':.64,'waist':.54,'hip':.46,'knee':.25,'ankle':.06,'bodyCenter':.5}.items()}
        if abs(delta)>.01:
            source=v['normalized'];aligned=Image.new('RGBA',(SIZE,SIZE))
            for y in range(SIZE):
                if y<=corrected:sy=PAD+(y-PAD)*(raw-PAD)/max(1,corrected-PAD)
                else:sy=raw+(y-corrected)*(SIZE-PAD-raw)/max(1,SIZE-PAD-corrected)
                sy=max(0,min(SIZE-1,round(sy)))
                aligned.paste(source.crop((0,sy,SIZE,sy+1)),(0,y))
            v['normalized']=aligned;v['mask']=aligned.getchannel('A').point(lambda a:255 if a>96 else 0)
            v['normalization']['perspectiveCompensation']['landmarkWarpApplied']=True
    return output
