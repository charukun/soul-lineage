from common import VERSION,evidence,median
from measurement import span,runs_at

def reconstruction_spec(identifier,name,views,measurements,detection,provenance,analysis=None):
    count=len(views); modes={1:'single-view',3:'multi-view',5:'enhanced-multi-view'}
    if count not in modes: raise ValueError('Unsupported view combination')
    levels=measurements['levels']; chin=levels['chin']; shoulder=levels['shoulder']
    components=[]
    def component(cid,bottom,top,bone,kind='loft',side=None,role='body'):
        rings=[]
        for i in range(9):
            y=bottom+(top-bottom)*i/8
            fr=span(views['front'],min(.99,max(.01,y)),central=True)
            br=span(views.get('back',views['front']),min(.99,max(.01,y)),central=True)
            width=((fr[1]-fr[0])+(br[1]-br[0]))/2
            cx=sum(fr)/2
            if side:
                runs=runs_at(views['front'],min(.99,max(.01,y)))
                candidates=[r for r in runs if r[0]*r[1]>0 and (sum(r)>0)==(side=='L')]
                if candidates:
                    r=max(candidates,key=lambda r:abs(sum(r)))
                    width=r[1]-r[0]; cx=sum(r)/2
                else:
                    sign=1 if side=='L' else -1
                    full=span(views['front'],min(.99,max(.01,y)))
                    leg='Leg' in bone or 'foot' in bone
                    width=min(width*(.42 if leg else .18),.09)
                    cx=sign*(abs(full[1] if sign>0 else full[0])*(.5 if leg else 1)-width*(0 if leg else .5))
            depth_range=span(views['side'],min(.99,max(.01,y)),True) if 'side' in views else [-width*.35,width*.35]
            depth=depth_range[1]-depth_range[0]; cz=-sum(depth_range)/2
            if side and not ('foot' in bone): depth=min(depth,width*1.15)
            if cid=='neck': width=min(width,.085); depth=min(depth,.08)
            if cid=='head' and i==0: width*=.68
            if cid=='head' and i==8: width*=.06; depth*=.1
            if cid=='pelvis': width=min(width,.26)
            rings.append([y,cx,cz,max(.006,width/2),max(.006,depth/2)])
        components.append({'id':cid,'bone':bone,'kind':kind,'role':role,'rings':rings,'status':'interpolated' if count>1 else 'inferred',
          'evidence':{'width':['front']+(['back'] if 'back' in views else []),'depth':['side'] if 'side' in views else [],'decomposition':'inferred humanoid part identity'}})
    component('head',chin,1,'head'); component('neck',shoulder,chin+.02,'neck')
    component('torso',.48,shoulder,'chest'); component('pelvis',.41,.51,'hips')
    for side in ('L','R'):
        for cid,bot,top,bone in [('upperArm',.53,shoulder,'upperArm'),('lowerArm',.39,.55,'lowerArm'),('hand',.34,.41,'hand'),('upperLeg',.25,.46,'upperLeg'),('lowerLeg',.065,.27,'lowerLeg'),('foot',.005,.07,'foot')]:
            component(cid+'.'+side,bot,top,bone+'.'+side,side=side)
    # Separate solid garment and hair shells, with back/side-driven volume. The
    # identity of these surfaces is deliberately a hypothesis until human review.
    component('clothing',.44,shoulder-.015,'chest',role='clothing')
    for ring in components[-1]['rings']: ring[3]*=1.025;ring[4]*=1.025
    component('rearHair',chin+.01,.995,'head',kind='rear-shell',role='hair')
    for ring in components[-1]['rings']: ring[3]*=1.018;ring[4]*=1.06
    # Astra may supply semantic bands for hood/cape/hat/accessories when the
    # flat-mask segmenter cannot identify them. Width/depth still come from views.
    for part in (analysis or {}).get('parts',[]):
        if not isinstance(part,dict) or part.get('role') not in ('hood','hat','hair','clothing','cape','accessory'):
            raise ValueError('Unknown semantic component role')
        bottom,top=part.get('verticalBand',[])
        if not 0<=bottom<top<=1:raise ValueError('Invalid semantic component height band')
        cid=part.get('id','')
        if not cid or any(c['id']==cid for c in components):raise ValueError('Component ids must be unique')
        bone=part.get('bone','chest')
        if bone not in ('head','neck','chest','spine','hips'):raise ValueError('Unsupported auxiliary parent')
        component(cid,bottom,top,bone,kind='rear-shell' if part.get('rearOnly') else 'loft',role=part['role'])
        components[-1]['evidence']['semanticSource']='Astra analysis; inferred part identity'
    # Facial planes are derived from the SIDE outline at semantic face bands;
    # normals and geometry vary per ring, rather than a sphere with a front decal.
    face={}
    for feature,f in [('forehead',.78),('eyePlane',.60),('cheek',.48),('nose',.40),('mouthPlane',.25),('jaw',.14),('chin',.02)]:
        y=chin+(1-chin)*f
        face[feature]={'y':y,'width':span(views['front'],y,True)[1]-span(views['front'],y,True)[0],
          'forward':-span(views['side'],y,True)[0] if 'side' in views else .09,'status':'interpolated' if 'side' in views else 'inferred','views':['front','side'] if 'side' in views else ['front']}
    return {'schemaVersion':'rinne.character-reconstruction/v1','forgeVersion':VERSION,'id':identifier,'displayName':name,'reconstructionMode':modes[count],
      'views':{v:{'source':f'source/{v}.png','status':'observed','sha256':s['sha256'],'sheetRect':s.get('sheetRect')} for v,s in views.items()},
      'viewDetection':detection,'normalizedMeasurements':{v:s['normalization'] for v,s in views.items()},'landmarksPerView':measurements['landmarks'],
      'bodyProportions':measurements['widths'],'depthMeasurements':measurements['depths'],'levels':levels,'face':face,'silhouette':measurements['profiles'],'components':components,
      'materialRegions':[{'id':c['id'],'role':c['role'],'status':'inferred'} for c in components],'textureProjectionRegions':[],
      'inferredRegions':['armpits','undersides','joint locations','occluded surfaces','garment/hair semantic segmentation']+(['side','back'] if count==1 else ['opposite side']),
      'unknownRegions':['hidden accessories','garment interior','finger separation','true perspective camera','occluded face topology'],
      'assumptions':['Upright neutral full-body image on a flat/transparent background','Front faces +Z, up +Y, metres; target height 1.6','Side faces image-left; back is unmirrored','Joint positions are inferred, silhouette samples are observed','Raw lighting remains in projected color','Rear hair/clothing are candidate semantic hypotheses'],
      'provenance':provenance,'rig':{},'sockets':{},'validationMetadata':{'visualApproval':'pending','productionReady':False}}
