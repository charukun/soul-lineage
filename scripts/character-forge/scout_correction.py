"""Scout recipe correction after the rejected first real browser captures.

All surface generation remains in pinned img2threejs. Lathe profiles below are
reference-specific authoring DATA for upstream's existing buildLatheGeometry;
this module contains no mesher, loft implementation, or fallback generator.
"""
def apply_first_correction(spec,s,correct_units=True):
    nodes={n['id']:n for n in spec['componentTree']}
    def lathe(cid,width,height,depth,points):
        n=nodes[cid];n['primitive']='lathe';n['topologyClass']='continuous-sculpt'
        n['dimensions'].update(width=width*s,height=height*s,depth=depth*s)
        # Upstream gives an explicit transform.scale precedence over dimensions.
        # SDF's identity scale cannot be carried onto a unit-profile primitive.
        n['transform']['scale']=[width*s,height*s,depth*s] if correct_units else [1,1,1]
        n['geometryDescriptor']={'latheProfile':{'points':points,'segments':64},'uvStrategy':'camera-solved multi-view projection baked after geometry acceptance'}
        n['topologyRationale']='Observed front contour revolved by the pinned upstream lathe generator. Elliptical transverse section inferred; side depth constrains its scale. No RINNE loft.'
    # The original artwork has a flat hem and a visible waist, not an oval body.
    # Points are [radius/68, (164.5-source_row)/117], bottom to top.
    lathe('chest',68,117,49,[[0,-.5],[31/68,-.5],[25/68,(164.5-184)/117],[34/68,(164.5-150)/117],[24/68,.5],[0,.5]])
    nodes['chest']['transform']['position'][1]=(212-164.5)*s
    # Child translations compensate the changed torso origin; world positions
    # stay tied to the measured pixels rather than moving with an oval's centre.
    for n in nodes.values():
        if n.get('parent')=='chest':n['transform']['position'][1]+=1.5*s
    lathe('pelvis',54,12,32,[[0,-.5],[.5,-.5],[.5,.5],[0,.5]])
    lathe('neck',18,18,18,[[0,-.5],[.5,-.5],[.5,.5],[0,.5]])
    for side in ('l','r'):
        # Continuous-width capsules replace the bead-like ellipsoids. Shaft
        # lengths + 2*radius equal the measured extents; overlaps are internal.
        for cid,radius,shaft in [('upper-arm-'+side,9,36),('forearm-'+side,9,36),('hand-'+side,9,8)]:
            n=nodes[cid];n['geometryDescriptor']['sdf']['primitives']=[{'id':cid+'-mass','type':'capsule','radius':radius*s,'height':shaft*s}]
        # Straight trousers and flat soles in the source are not round balls.
        profile=[[0,-.5],[.46,-.5],[.5,-.46],[.5,.46],[.46,.5],[0,.5]]
        lathe('thigh-'+side,21,62,28,profile)
        lathe('shin-'+side,21,56,28,profile)
        lathe('boot-'+side,29,34,48,[[0,-.5],[.3,-.5],[.45,-.44],[.5,-.32],[.5,.32],[.45,.44],[.3,.5],[0,.5]])
    head=nodes['head']['geometryDescriptor']['sdf']
    values=[('cranium',[0,3,-4],[28.8,35,24]),('jaw',[0,-18,2],[22,18,18]),('cheek-l',[-12,-7,7],[14,19,13]),('cheek-r',[12,-7,7],[14,19,13]),('chin',[0,-29,2],[14,8,14]),('nose',[0,-6,28],[3,5,3])]
    head['primitives']=[{'id':name,'type':'ellipsoid','center':[v*s for v in center],'radii':[v*s for v in radii]} for name,center,radii in values]
    hair=nodes['hair'];hair['role']='hair'
    # Gate this subject as hair. The scalp profile is a declared upper-cranium
    # proxy in component-local metres; head/face blending below it is not scalp.
    import math
    rings=[]
    for i in range(25):
        y=-32+70*i/24;r=math.sqrt(max(0,1-((y-3)/35)**2))
        rings.append([y*s,max(.01,28.8*r)*s,max(.01,24*r)*s,-4*s])
    nodes['head']['geometryDescriptor']['ringStack']={'rings':rings}
    hair['standProud']={'againstComponentId':'head','clearance':.3*s,'maxPush':1.5*s}
    h=hair['geometryDescriptor']['sdf']
    h['primitives']=[{'id':'cap','type':'ellipsoid','center':[0,8*s,0],'radii':[35*s,39*s,28*s]},
      {'id':'back-lock','type':'ellipsoid','center':[0,-15*s,-15*s],'radii':[24*s,27*s,10*s]},
      {'id':'face-opening','type':'box','center':[0,-28*s,25*s],'size':[58*s,100*s,42*s]}]
    spec['hairProfile']={'representationTier':'shell','scalpComponentId':'head','hairline':{'controlPoints':[{'u':.1,'v':.68},{'u':.25,'v':.62},{'u':.4,'v':.68}],'status':'inferred scalp parameterization of observed fringe'},'flowField':{'gravity':1,'uncalibrated':True,'partLine':{'u':.2}},'masses':[]}
    spec['risks'].append('Input inconsistency: the back hair extends to row 125 but front silhouette is bare neck at rows 96–106. An opaque shape cannot match both exactly. The first correction narrows the nape; all three view errors remain reported.')
    # Painted detail is judged when projection is present. Shape goals remain
    # mandatory in every pass; no threshold is lowered to approve this revision.
    later=['material-pass','surface-pass','lighting-pass','interaction-pass','optimization-pass']
    for target in spec['featureReviewTargets']:
        if target['id']=='outfit-and-palette':target['passIds']=later
        if target['id']=='face-landmark-placement':
            target['name']='Face width, forehead, cheek, jaw, chin and nose profile; painted eyes/mouth from material pass'
