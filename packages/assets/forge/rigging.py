def create_rig(spec):
    levels=spec['levels'];comps={c['id']:c for c in spec['components']};bones=[]
    def add(name,parent,position):bones.append({'name':name,'parent':parent,'position':position})
    add('root',None,[0,0,0]);add('hips','root',[0,.46,0]);add('spine','hips',[0,.55,0]);add('chest','spine',[0,.65,0]);add('neck','chest',[0,levels['shoulder'],0]);add('head','neck',[0,levels['chin'],0])
    for side in ('L','R'):
        arm=comps['upperArm.'+side]['rings'][-1][1];leg=comps['upperLeg.'+side]['rings'][-1][1]
        add('shoulder.'+side,'chest',[arm*.6,levels['shoulder'],0])
        add('upperArm.'+side,'shoulder.'+side,[arm,levels['shoulder'],0]);add('lowerArm.'+side,'upperArm.'+side,[comps['lowerArm.'+side]['rings'][-1][1],.54,0]);add('hand.'+side,'lowerArm.'+side,[comps['hand.'+side]['rings'][-1][1],.39,0])
        add('upperLeg.'+side,'hips',[leg,.45,0]);add('lowerLeg.'+side,'upperLeg.'+side,[comps['lowerLeg.'+side]['rings'][-1][1],.26,0]);add('foot.'+side,'lowerLeg.'+side,[comps['foot.'+side]['rings'][-1][1],.055,0])
        if spec.get('rigProfile')=='golden-rig':
            hand=comps['hand.'+side]['rings'][4];sign=1 if side=='L' else -1
            for index,name in enumerate(('thumb','index','middle','ring','little')):
                add(f'{name}.{side}','hand.'+side,[hand[1]+sign*.008*(index-2),hand[0],hand[2]+.008*(2-index)])
    rig_id='rinne.golden.humanoid.v1' if spec.get('rigProfile')=='golden-rig' else 'rinne.forge.humanoid.v1'
    spec['rig']={'id':rig_id,'profile':'Golden Rig' if spec.get('rigProfile')=='golden-rig' else 'Forge Humanoid','coordinateSystem':'+Y up, +Z forward','bindPose':'neutral reference','bones':bones,'jointStatus':'inferred','skin':'linear-blend'}
    return bones
