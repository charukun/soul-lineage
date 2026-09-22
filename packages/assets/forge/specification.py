from common import VERSION
from measurement import span,runs_at,side_profile

PROFILE_SHAPES={
 'head':{'frontPower':1.7,'backPower':1.35},'chest':{'frontPower':1.45,'backPower':1.7},
 'abdomen':{'frontPower':1.55,'backPower':1.65},'hips':{'frontPower':1.7,'backPower':1.35},
 'limb':{'frontPower':1.8,'backPower':1.8},'hand':{'frontPower':2.1,'backPower':2.1},
 'foot':{'frontPower':1.35,'backPower':2.2},'default':{'frontPower':1.7,'backPower':1.7}}

def reconstruction_spec(identifier,name,views,measurements,detection,provenance,analysis=None):
    count=len(views);modes={1:'single-view',3:'multi-view',5:'enhanced-multi-view'}
    if count not in modes:raise ValueError('Unsupported view combination')
    analysis=analysis or {}
    levels=measurements['levels'];chin=levels['chin'];shoulder=levels['shoulder'];components=[]
    def component(cid,bottom,top,bone,kind='loft',side=None,role='body',profile='default'):
        rings=[]
        for i in range(9):
            y=bottom+(top-bottom)*i/8; yy=min(.99,max(.01,y))
            fr=span(views['front'],yy,True);br=span(views.get('back',views['front']),yy,True)
            width=((fr[1]-fr[0])+(br[1]-br[0]))/2;cx=sum(fr)/2
            if side:
                runs=runs_at(views['front'],yy);candidates=[r for r in runs if r[0]*r[1]>0 and (sum(r)>0)==(side=='L')]
                if candidates:r=max(candidates,key=lambda r:abs(sum(r)));width=r[1]-r[0];cx=sum(r)/2
                else:
                    sign=1 if side=='L' else -1;full=span(views['front'],yy);leg='Leg' in bone or 'foot' in bone
                    width=min(width*(.42 if leg else .18),.09);cx=sign*(abs(full[1] if sign>0 else full[0])*(.5 if leg else 1)-width*(0 if leg else .5))
            if 'side' in views:p=side_profile(views['side'],yy);front_depth=p['frontDepth'];back_depth=p['backDepth']
            else:front_depth=back_depth=width*.35
            if cid=='neck':width=min(width,.085);front_depth=min(front_depth,.04);back_depth=min(back_depth,.04)
            if cid=='head' and i==0:width*=.68
            if cid=='head' and i==8:width*=.06;front_depth*=.1;back_depth*=.1
            if cid=='pelvis':width=min(width,.26)
            rings.append({'y':y,'cx':cx,'rx':max(.006,width/2),'frontDepth':max(.006,front_depth),'backDepth':max(.006,back_depth),
              'centerOffset':(front_depth-back_depth)/2,**PROFILE_SHAPES[profile]})
        components.append({'id':cid,'bone':bone,'kind':kind,'role':role,'sectionProfile':profile,'rings':rings,'status':'interpolated' if count>1 else 'inferred',
          'evidence':{'width':['front']+(['back'] if 'back' in views else []),'depth':['side'] if 'side' in views else [],'decomposition':'inferred humanoid part identity'}})
    component('head',chin,1,'head',profile='head');component('neck',shoulder,chin+.02,'neck')
    component('torso',.48,shoulder,'chest',profile='chest');component('pelvis',.41,.51,'hips',profile='hips')
    for side in ('L','R'):
        for cid,bot,top,bone,profile in [('upperArm',.53,shoulder,'upperArm','limb'),('lowerArm',.39,.55,'lowerArm','limb'),('hand',.34,.41,'hand','hand'),('upperLeg',.25,.46,'upperLeg','limb'),('lowerLeg',.065,.27,'lowerLeg','limb'),('foot',.005,.07,'foot','foot')]:
            component(cid+'.'+side,bot,top,bone+'.'+side,side=side,profile=profile)
    # Golden Base / mannequin inputs can explicitly suppress semantic shells.
    # The flag is authored by Astra from the user's character intent, never inferred
    # merely from color. Projected source color still lands on the underlying body.
    if not analysis.get('baseMeshOnly'):
        component('clothing',.44,shoulder-.015,'chest',role='clothing',profile='chest')
        for ring in components[-1]['rings']:ring['rx']*=1.025;ring['frontDepth']*=1.025;ring['backDepth']*=1.025
        component('rearHair',chin+.01,.995,'head',kind='rear-shell',role='hair',profile='head')
        for ring in components[-1]['rings']:ring['rx']*=1.018;ring['backDepth']*=1.06
    for part in analysis.get('parts',[]):
        if not isinstance(part,dict) or part.get('role') not in ('hood','hat','hair','clothing','cape','accessory'):raise ValueError('Unknown semantic component role')
        bottom,top=part.get('verticalBand',[])
        if not 0<=bottom<top<=1:raise ValueError('Invalid semantic component height band')
        cid=part.get('id','')
        if not cid or any(c['id']==cid for c in components):raise ValueError('Component ids must be unique')
        bone=part.get('bone','chest')
        if bone not in ('head','neck','chest','spine','hips'):raise ValueError('Unsupported auxiliary parent')
        component(cid,bottom,top,bone,kind='rear-shell' if part.get('rearOnly') else 'loft',role=part['role'],profile='default')
        components[-1]['evidence']['semanticSource']='Astra analysis; inferred part identity'
    face={}
    for feature,f in [('forehead',.78),('eyePlane',.60),('cheek',.48),('nose',.40),('mouthPlane',.25),('jaw',.14),('chin',.02)]:
        y=chin+(1-chin)*f
        if 'side' in views:p=side_profile(views['side'],y);forward=p['frontDepth'];back=p['backDepth']
        else:forward=back=.09
        face[feature]={'y':y,'width':span(views['front'],y,True)[1]-span(views['front'],y,True)[0],'forward':forward,'backward':back,
          'centerOffset':(forward-back)/2,'status':'interpolated' if 'side' in views else 'inferred','views':['front','side'] if 'side' in views else ['front']}
    return {'schemaVersion':'rinne.character-reconstruction/v1','forgeVersion':VERSION,'id':identifier,'displayName':name,'reconstructionMode':modes[count],
      'views':{v:{'source':f'source/{v}.png','status':'observed','sha256':s['sha256'],'sheetRect':s.get('sheetRect')} for v,s in views.items()},
      'viewDetection':detection,'normalizedMeasurements':{v:s['normalization'] for v,s in views.items()},'landmarksPerView':measurements['landmarks'],
      'bodyProportions':measurements['widths'],'depthMeasurements':measurements['depths'],'levels':levels,'face':face,'silhouette':measurements['profiles'],'components':components,
      'materialRegions':[{'id':c['id'],'role':c['role'],'status':'inferred'} for c in components],'textureProjectionRegions':[],
      'inferredRegions':['armpits','undersides','joint locations','occluded surfaces','garment/hair semantic segmentation']+(['side','back'] if count==1 else ['opposite side']),
      'unknownRegions':['hidden accessories','garment interior','finger separation','true perspective camera','occluded face topology'],
      'assumptions':['Upright neutral full-body image on a flat/transparent background','Front faces +Z, up +Y, metres; target height 1.6','Side faces image-left; back is unmirrored','Side sections preserve independent front/back depth instead of symmetric ellipses','Joint positions are inferred, silhouette samples are observed','Raw lighting remains in projected color'],
      'provenance':provenance,'rig':{},'sockets':{},'validationMetadata':{'visualApproval':'pending','productionReady':False}}
