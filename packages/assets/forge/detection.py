from intake import foreground

def detect_views(sources, order=None):
    if 'sheet' not in sources:
        if 'front' not in sources:
            raise ValueError('A front view is required')
        if len(sources) not in (1,3,5) or (len(sources)>=3 and not {'front','side','back'} <= sources.keys()):
            raise ValueError('Use front; front/side/back; or all five named views')
        return sources, {'method':'explicit-view-names', 'status':'observed'}
    sheet = sources['sheet']
    mask = foreground(sheet['image'])
    w,h = mask.size
    # Project occupied columns. Detached labels cannot reach the body-height floor.
    hits = [sum(mask.getpixel((x,y))>0 for y in range(h)) >= h*.09 for x in range(w)]
    spans=[]; start=None; gap=0
    for x,on in enumerate(hits+[False]*max(2,int(w*.012)+1)):
        if on:
            if start is None: start=x
            gap=0
        elif start is not None:
            gap+=1
            if gap>max(2,int(w*.012)):
                end=x-gap+1
                if end-start>w*.035: spans.append((start,end))
                start=None
    if len(spans) not in (1,3,5):
        raise ValueError(f'Sheet has {len(spans)} ambiguous regions. Astra must supply separate semantic views; no silent single-view downgrade.')
    names = (order.split(',') if order else {1:['front'],3:['front','side','back'],5:['front','front34','side','back34','back']}[len(spans)])
    if set(names) != set({1:['front'],3:['front','side','back'],5:['front','front34','side','back34','back']}[len(spans)]):
        raise ValueError('Invalid semantic sheet order')
    result={}
    rects={}
    for name,(left,right) in zip(names,spans):
        pad=max(2,int((right-left)*.04))
        rect=(max(0,left-pad),0,min(w,right+pad),h)
        result[name]={**sheet,'image':sheet['image'].crop(rect),'sheetRect':list(rect)}
        rects[name]=list(rect)
    return result, {'method':'foreground-column-gaps','order':names,'status':'inferred' if order is None else 'observed','assumption':'Left-to-right semantic order; Astra checks intake contact sheet before adoption','rects':rects}
