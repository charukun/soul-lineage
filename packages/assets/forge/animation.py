import math

def quat(axis,angle):
    s=math.sin(angle/2);return [axis[0]*s,axis[1]*s,axis[2]*s,math.cos(angle/2)]

def create_animations(bones):
    index={b['name']:i for i,b in enumerate(bones)}; clips=[]
    for name,duration,loop in [('Idle',3,True),('Walk',1,True),('Talk',2,True),('Attack',.85,False),('Hit',.5,False),('Rest',2.4,True),('Run',.65,True),('Pickup',1.5,False),('Jump',1,False),('Fall',1,True)]:
        tracks=[];times=[duration*i/16 for i in range(17)]
        def rotate(bone,axis,fn): tracks.append({'bone':index[bone],'path':'rotation','times':times,'values':[quat(axis,fn(i/16)) for i in range(17)]})
        if name=='Idle': rotate('chest',[1,0,0],lambda t:.025*math.sin(t*2*math.pi))
        if name in ('Walk','Run'):
            amplitude=.4 if name=='Walk' else .65
            for side,s in [('L',1),('R',-1)]:
                rotate('upperLeg.'+side,[1,0,0],lambda t,s=s:s*amplitude*math.sin(t*2*math.pi))
                rotate('lowerLeg.'+side,[1,0,0],lambda t,s=s:max(0,s*math.sin(t*2*math.pi))*.7)
                rotate('upperArm.'+side,[1,0,0],lambda t,s=s:-s*.32*math.sin(t*2*math.pi))
        if name=='Talk':
            rotate('head',[0,1,0],lambda t:.14*math.sin(t*2*math.pi));rotate('lowerArm.R',[1,0,0],lambda t:-.55-.2*math.sin(t*2*math.pi))
        if name=='Attack':
            rotate('upperArm.R',[1,0,0],lambda t:-1.8*math.sin(math.pi*t));rotate('chest',[0,1,0],lambda t:.4*math.sin(2*math.pi*t))
        if name=='Hit':rotate('chest',[1,0,0],lambda t:-.3*math.sin(math.pi*t));rotate('head',[1,0,0],lambda t:-.22*math.sin(math.pi*t))
        if name=='Rest':
            rotate('head',[1,0,0],lambda t:.22+.025*math.sin(2*math.pi*t));rotate('chest',[1,0,0],lambda t:.14+.025*math.sin(2*math.pi*t))
        if name=='Pickup':
            rotate('chest',[1,0,0],lambda t:.8*math.sin(math.pi*t));rotate('upperArm.R',[1,0,0],lambda t:-.6*math.sin(math.pi*t))
        if name in ('Jump','Fall'):
            for side,s in [('L',1),('R',-1)]:rotate('upperArm.'+side,[0,0,1],lambda t,s=s:s*(.6+.08*math.sin(2*math.pi*t)))
            if name=='Jump':
                hip=bones[index['hips']]['position'];parent=bones[index['root']]['position']
                tracks.append({'bone':index['hips'],'path':'translation','times':times,'values':[[hip[0],hip[1]+.1*math.sin(math.pi*i/16),hip[2]] for i in range(17)]})
        clips.append({'name':name,'duration':duration,'loop':loop,'tracks':tracks,'status':'generated','source':'RINNE-owned candidate motion, not motion capture'})
    return clips
