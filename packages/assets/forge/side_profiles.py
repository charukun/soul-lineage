"""Side-constrained, asymmetric cross sections. Anatomical axes remain hypotheses."""
import math

SCHEMA = 'rinne.forge-side-reconstruction/v1'
# Fullness controls curvature, not the observed front/back endpoints.
SHAPES = {
    'cranium': (1.15, 1.20, 1.0), 'thorax': (1.25, .90, 1.0),
    'abdomen': (1.10, .85, 1.0), 'pelvis': (1.00, 1.10, 1.0),
    'glute': (.90, 1.35, 1.0), 'neck': (1.0, 1.0, 1.0),
    'upperArm': (1.12, .95, 1.10), 'lowerArm': (1.00, .90, .95),
    'hand': (.90, 1.05, .65), 'upperLeg': (1.20, 1.00, 1.15),
    'lowerLeg': (.85, 1.25, 1.05), 'foot': (1.30, .80, 1.0),
}
FACE_FULLNESS = {'forehead':1.25, 'eyePlane':1.30, 'cheek':1.35,
                 'nose':.60, 'mouthPlane':.95, 'jaw':1.10, 'chin':.85}

def finite(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError('Finite number required: ' + label)
    return float(value)

def lerp(a, b, t):
    return a * (1-t) + b * t

def interpolate(rows, y, getter):
    if y <= rows[0]['y']:
        return getter(rows[0])
    if y >= rows[-1]['y']:
        return getter(rows[-1])
    for a, b in zip(rows, rows[1:]):
        if a['y'] <= y <= b['y']:
            t = (y-a['y'])/(b['y']-a['y'])
            return [lerp(x,z,t) for x,z in zip(getter(a), getter(b))]
    raise ValueError('Unordered profile')

def side_bounds(rows, y, facing='left'):
    valid = [r for r in rows if r.get('runs')]
    if not valid:
        return None
    def ends(row):
        # Anatomical separation is not asserted when silhouettes overlap.
        lo, hi = min(row['runs'], key=lambda r:abs(sum(r)))
        return [-lo, -hi] if facing == 'left' else [hi, lo]
    return interpolate(valid, y, ends)  # frontZ, backZ in +Z-front space

def region_for(component, y, levels):
    name = component['id'].split('.')[0]
    if name in ('head','rearHair'):
        return 'cranium'
    if name in ('torso','clothing'):
        return 'thorax' if y >= levels['waist'] + .035 else 'abdomen'
    if name == 'pelvis':
        return 'glute' if y < levels['hip'] + .015 else 'pelvis'
    return name if name in SHAPES else 'thorax'

def curve(value, fullness):
    """Monotone rounded cross-section, endpoints unchanged, no ellipse assumption."""
    return value + (fullness-1)*value*(1-value*value)

def apply_side_profiles(spec, analysis=None):
    options = (analysis or {}).get('sideReconstruction', {})
    if not isinstance(options, dict):
        raise ValueError('sideReconstruction must be an object')
    facing = options.get('facing','left')
    if facing != 'left':
        raise ValueError('Current Forge intake requires image-left Side; normalize the reference before authoring')
    overrides = options.get('regions', {})
    if not isinstance(overrides, dict) or any(k not in SHAPES for k in overrides):
        raise ValueError('Unknown side section region')
    shapes = {k:dict(zip(('frontFullness','backFullness','occludedDepthRatio'),v)) for k,v in SHAPES.items()}
    for name, values in overrides.items():
        if not isinstance(values,dict) or any(k not in (*shapes[name], 'axisOffset') for k in values):
            raise ValueError('Unknown section parameter')
        for key, value in values.items():
            value = finite(value, key)
            if key.endswith('Fullness') and not .55 <= value <= 1.45:
                raise ValueError('Fullness must be in [0.55,1.45]')
            if key == 'occludedDepthRatio' and not .4 <= value <= 1.6:
                raise ValueError('Invalid occluded depth ratio')
            if key == 'axisOffset' and abs(value) > .15:
                raise ValueError('Axis offset exceeds normalized height bound')
            shapes[name][key] = value
    rows = spec['silhouette'].get('side', [])
    levels = spec['levels']
    def axis(y):
        bounds = side_bounds(rows,y,facing)
        return sum(bounds)/2 if bounds else 0.0
    # Silhouettes determine exterior endpoints, not a unique internal anatomical axis.
    anchors = [{'y':.055,'z':axis(.055)}, {'y':levels['hip'],'z':axis(levels['hip'])},
               {'y':levels['shoulder'],'z':axis(levels['shoulder'])},
               {'y':levels['chin'],'z':axis(levels['chin'])}]
    anchors.sort(key=lambda r:r['y'])
    measurements = {}
    for key,y in {**levels, **{k:v['y'] for k,v in spec['face'].items()}}.items():
        endpoints = side_bounds(rows,y,facing)
        if endpoints:
            front,back=endpoints
            center=interpolate(anchors,y,lambda r:[r['z']])[0]
            center=max(back+.05*(front-back),min(front-.05*(front-back),center))
            measurements[key]={'y':y,'frontZ':front,'backZ':back,'centerOffset':center,
                               'frontDepth':front-center,'backDepth':center-back,
                               'endpointsStatus':'interpolated','centerStatus':'inferred'}
    for comp in spec['components']:
        legacy = comp['rings']
        # Keep named facial/body planes as actual geometry rings, not just metadata.
        extra = []
        if comp['id']=='head':
            extra = [f['y'] for f in spec['face'].values()]
        elif comp['id'] in ('torso','clothing','pelvis'):
            extra = [levels['chest'],levels['waist'],levels['hip'],levels['hip']+.015]
        heights=sorted(set([r[0] for r in legacy]+[y for y in extra if legacy[0][0]<y<legacy[-1][0]]))
        oldrows=[{'y':r[0],'ring':r} for r in legacy]
        rings=[];sections=[]
        for y in heights:
            ring=interpolate(oldrows,y,lambda r:r['ring'])
            region=region_for(comp,y,levels); shape=shapes[region]
            endpoints=side_bounds(rows,y,facing)
            front,back=endpoints if endpoints else (ring[2]+ring[4],ring[2]-ring[4])
            source_front,source_back=front,back
            center=interpolate(anchors,y,lambda r:[r['z']])[0]+shape.get('axisOffset',0)
            status='interpolated' if endpoints else 'inferred'
            occluded='.' in comp['id'] and region!='foot'
            if occluded:
                # A merged side silhouette is not a measured arm/leg thickness.
                depth=min(front-back,2*ring[3]*shape['occludedDepthRatio'])
                midpoint=(front+back)/2
                front,back=midpoint+depth/2,midpoint-depth/2
                status='inferred'
            if comp['id']=='neck':
                depth=min(front-back,.08);midpoint=(front+back)/2
                front,back=midpoint+depth/2,midpoint-depth/2
                status='inferred'
            if comp['id'] in ('head','rearHair') and y==heights[-1]:
                midpoint=(front+back)/2;depth=(front-back)*.1
                front,back=midpoint+depth/2,midpoint-depth/2
            thickness=1.06 if comp['id']=='rearHair' else 1.025 if comp['id']=='clothing' else 1.0
            mid=(front+back)/2;front=mid+(front-mid)*thickness;back=mid+(back-mid)*thickness
            extent=max(.012,front-back)
            if front-back<.012:front,back=mid+.006,mid-.006
            if not endpoints:center=ring[2]
            center=max(back+.12*extent,min(front-.12*extent,center))
            ff=shape['frontFullness']
            if comp['id']=='head':
                face_rows=sorted([{'y':f['y'],'fullness':FACE_FULLNESS[k]} for k,f in spec['face'].items()],key=lambda r:r['y'])
                ff=interpolate(face_rows,y,lambda r:[r['fullness']])[0]
            ring[2]=(front+back)/2;ring[4]=(front-back)/2
            rings.append(ring)
            sections.append({'y':y,'region':region,'centerOffset':center,
              'frontDepth':front-center,'backDepth':center-back,'frontZ':front,'backZ':back,
              'frontFullness':ff,'backFullness':shape['backFullness'],
              'sourceEndpoints':[source_front,source_back] if endpoints else None,
              'status':status,'centerStatus':'inferred','occludedPart':occluded})
        comp['rings']=rings;comp['sectionProfiles']=sections
        comp['evidence']['crossSection']='asymmetric side-constrained profile; curvature and internal axis inferred'
    for key, face in spec['face'].items():
        if key in measurements:
            face.update({'forward':measurements[key]['frontZ'],'rear':measurements[key]['backZ'],
                         'centerOffset':measurements[key]['centerOffset']})
    spec['sideReconstruction']={'schemaVersion':SCHEMA,'facing':facing,
      'coordinates':'+Y up, +Z front; distances normalized by full character height',
      'method':'independent front/back endpoints, inferred anatomical centerline, regional non-elliptic curvature',
      'axisAnchors':anchors,'axisStatus':'inferred','regions':shapes,'measurements':measurements,
      'limitations':['A silhouette does not uniquely determine internal axes or hidden cross-section curvature',
                      'Overlapping arms/legs use explicit inferred part-depth priors, not observed total torso depth',
                      'Facial band identities are hypotheses; source samples are retained separately']}
    return spec

def depth_diagnostics(reference, rendered, spec):
    from normalization import SIZE,PAD,HEIGHT
    facing=spec.get('sideReconstruction',{}).get('facing','left')
    def ends(mask,y):
        row=max(0,min(SIZE-1,round(SIZE-PAD-y*HEIGHT)))
        xs=[x for x in range(SIZE) if mask.getpixel((x,row))>96]
        if not xs:return None
        lo=(min(xs)-SIZE/2)/HEIGHT;hi=(max(xs)+1-SIZE/2)/HEIGHT
        return (-lo,-hi) if facing=='left' else (hi,lo)
    samples=[]
    levels={**{k:v for k,v in spec['levels'].items() if 0<v<1},
            **{k:v['y'] for k,v in spec['face'].items()}}
    for name,y in list(levels.items())+[(f'row-{i}',i/100) for i in range(2,99)]:
        a,b=ends(reference,y),ends(rendered,y)
        if a is None or b is None:
            samples.append({'name':name,'y':y,'status':'missing-silhouette'});continue
        samples.append({'name':name,'y':y,'status':'diagnostic',
          'referenceFront':a[0],'referenceBack':a[1],'modelFront':b[0],'modelBack':b[1],
          'frontError':b[0]-a[0],'backError':b[1]-a[1],
          'totalDepthError':(b[0]-b[1])-(a[0]-a[1]),'centerError':(sum(b)-sum(a))/2})
    valid=[s for s in samples if s['status']=='diagnostic']
    maximum=lambda key:max((abs(s[key]) for s in valid),default=None)
    return {'unit':'fraction-of-full-body-height','axis':'+Z front',
      'metric':'fixed-camera exterior endpoints; centerError is silhouette midpoint, not anatomical center',
      'maxFrontError':maximum('frontError'),'maxBackError':maximum('backError'),
      'maxCenterError':maximum('centerError'),'maxTotalDepthError':maximum('totalDepthError'),
      'missingRows':len(samples)-len(valid),'samples':samples,
      'status':'needs-review' if len(valid)!=len(samples) or any(maximum(k)>.025 for k in ('frontError','backError')) else 'diagnostic-pass'}
