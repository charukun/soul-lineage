from common import clamp, median, evidence
from normalization import SIZE,PAD,HEIGHT

def runs_at(view,y):
    row=round(SIZE-PAD-y*HEIGHT); row=max(0,min(SIZE-1,row))
    runs=[]; start=None
    for x in range(SIZE+1):
        on=x<SIZE and view['mask'].getpixel((x,row))>0
        if on and start is None: start=x
        if not on and start is not None:
            if x-start>=2: runs.append([(start-SIZE/2)/HEIGHT,(x-SIZE/2)/HEIGHT])
            start=None
    return runs

def span(view,y,central=False):
    runs=runs_at(view,y)
    if not runs: return [-.01,.01]
    if central:
        return min(runs,key=lambda r:abs(sum(r)))
    return [runs[0][0],runs[-1][1]]

def measure_views(views):
    front=views['front']; profiles={}
    for name,v in views.items():
        profiles[name]=[{'y':i/100,'range':span(v,i/100),'runs':runs_at(v,i/100)} for i in range(1,100)]
    # Neck notch is a measured silhouette minimum; semantic identity remains inference.
    neck_candidates=[(span(front,i/100,True)[1]-span(front,i/100,True)[0],i/100) for i in range(65,89)]
    neck=min(neck_candidates)[1]
    # Reject a notch at an arbitrary search boundary and use an explicitly inferred prior.
    neck_status='interpolated' if .65<neck<.88 else 'inferred'
    if neck_status=='inferred': neck=.76
    chin=min(.91,neck+.025); shoulder=neck-.045
    levels={'headTop':1,'chin':chin,'shoulder':shoulder,'chest':shoulder-.065,'waist':shoulder-.17,'hip':.46,'knee':.25,'ankle':.06,'sole':0,'bodyCenter':.5}
    landmarks={}
    for name,v in views.items():
        landmarks[name]={key:{'normalized':[0,y,0],'rawPixel':[v['normalization']['rawBounds'][0]+(v['normalization']['rawBounds'][2]-v['normalization']['rawBounds'][0])/2,v['normalization']['rawBounds'][3]-y*(v['normalization']['rawBounds'][3]-v['normalization']['rawBounds'][1])],
          'status':'observed' if key in ('headTop','sole') else 'inferred','method':'foreground-extrema' if key in ('headTop','sole') else 'shared anatomical hypothesis, sampled against silhouette; not a detected joint'} for key,y in levels.items()}
    widths={key:evidence(span(front,y,True)[1]-span(front,y,True)[0],'observed',['front'],'foreground width at inferred anatomical height') for key,y in levels.items() if 0<y<1}
    depths={key:evidence(span(views['side'],y,True)[1]-span(views['side'],y,True)[0],'observed',['side'],'side silhouette at shared normalized height') if 'side' in views else evidence(widths[key]['value']*.7,'inferred',['front'],'elliptical depth prior') for key,y in levels.items() if key in widths}
    return {'profiles':profiles,'landmarks':landmarks,'levels':levels,'widths':widths,'depths':depths,'neckStatus':neck_status}
