import math

def create_morphs(spec,meshes):
    names=['Blink','Smile','MouthOpen']
    head=next((m for m in meshes if m['id']=='head'),None)
    if not head:
        spec['morphs']=[];return []
    chin=spec['levels']['chin'];height=max(.001,1-chin)
    targets={name:[] for name in names}
    for p in head['positions']:
        x,y,z=p;v=(y-chin)/height
        face=max(0,z-head['component']['rings'][4][2])
        center=max(0,1-abs(x)/.13)
        eye=math.exp(-((v-.60)/.055)**2)*center
        mouth=math.exp(-((v-.25)/.055)**2)*center
        smile_side=min(1,abs(x)/.12)*mouth
        targets['Blink'].append([0,-.010*eye,.004*eye if face>=0 else 0])
        targets['Smile'].append([0,.012*smile_side,.004*mouth])
        targets['MouthOpen'].append([0,-.014*mouth,.010*mouth])
    head['morphTargets']=[{'name':name,'deltas':targets[name]} for name in names]
    spec['morphs']=[{'name':name,'mesh':'head','status':'generated','topologyPreserving':True} for name in names]
    return spec['morphs']
