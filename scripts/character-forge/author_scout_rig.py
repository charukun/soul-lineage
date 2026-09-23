"""Reference-specific joint authoring DATA for the shared RINNE rig contract.

Source rectangles are observations. Joint centres, bend planes and bone tips are
explicit inferences inside those regions, never a claim of measured anatomy.
"""
import argparse,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/assets/forge'))
from upstream_workspace import write_json
from sockets import create_sockets

def author(w):
    evidence=json.loads((w/'img2threejs/evidence/landmarks.json').read_text())
    spec=json.loads((w/'object-sculpt-spec.json').read_text())
    body=evidence['views']['front']['body'];face=evidence['views']['front']['face']
    height=evidence['heightMetres'];scale=height/(evidence['feetRow']-evidence['crownRow'])
    center=(face['headBounds'][0]+face['headBounds'][2])/2
    def world(x,row,z=0):return [(x-center)*scale,(evidence['feetRow']-row)*scale,z*scale]
    bones=[]
    def joint(name,parent,p,tip,refs,note):
        bones.append({'id':name,'parent':parent,'jointPos':p,'tipPos':tip,'observationClass':'inferred','evidenceRefs':refs,'reason':note})
    hip_row=body['legs'][0][1];neck_row=sum(body['neck'][i] for i in (1,3))/2
    chest_row=(body['torso'][1]+body['waist'][1])/2;spine_row=(chest_row+hip_row)/2
    joint('hips',None,world(center,hip_row),world(center,spine_row),['front.body.legs','front.body.torso'],'Pelvic root inferred at the upper-leg boundary inside the tunic.')
    joint('spine','hips',world(center,spine_row),world(center,chest_row),['front.body.torso','front.body.waist'],'Spine midpoint inferred between observed torso/leg regions.')
    joint('chest','spine',world(center,chest_row),world(center,neck_row),['front.body.torso','front.body.neck'],'Chest pivot inferred in the upper tunic.')
    joint('neck','chest',world(center,neck_row),world(center,face['chinRow']),['front.body.neck','front.face.chinRow'],'Neck centre follows the observed neck rectangle.')
    joint('head','neck',world(center,face['chinRow']),world(center,evidence['crownRow']),['front.face','side.headBounds'],'Head pivots near observed chin/neck; head and short hair share rigid motion.')
    # Common Rig_Medium names independently assign anatomical L/R. Front view
    # shows the character's left on image right; the gate must test that claim.
    for side,region_index in [('L',1),('R',0)]:
        arm=body['arms'][region_index];leg=body['legs'][region_index];boot=body['boots'][region_index]
        arm_x=(arm[0]+arm[2])/2;leg_x=(leg[0]+leg[2])/2;arm_radius=(arm[2]-arm[0])/2
        shoulder_row=arm[1]+arm_radius;wrist_row=arm[3]-2*arm_radius;elbow_row=(shoulder_row+wrist_row)/2
        ankle_row=boot[1]+(boot[3]-boot[1])*.35;knee_row=(hip_row+ankle_row)/2
        joint('upperArm.'+side,'chest',world(arm_x,shoulder_row),world(arm_x,elbow_row),['front.body.arms','side.body.arm'],'Shoulder centre inside rounded arm cap; elbow interpolated between shoulder and wrist.')
        joint('lowerArm.'+side,'upperArm.'+side,world(arm_x,elbow_row),world(arm_x,wrist_row),['front.body.arms','side.body.arm'],'Forearm pivot interpolated; no invisible elbow claimed observed.')
        joint('hand.'+side,'lowerArm.'+side,world(arm_x,wrist_row),world(arm_x,arm[3]-arm_radius),['front.body.arms','side.anchors.hand'],'Wrist/palm inferred within the observed rounded hand. Source side/front endpoint discrepancy retained.')
        joint('upperLeg.'+side,'hips',world(leg_x,hip_row),world(leg_x,knee_row),['front.body.legs'],'Hip/knee inferred inside observed trousers.')
        joint('lowerLeg.'+side,'upperLeg.'+side,world(leg_x,knee_row),world(leg_x,ankle_row),['front.body.legs','front.body.boots'],'Knee inferred midway to the boot-supported ankle.')
        joint('foot.'+side,'lowerLeg.'+side,world(leg_x,ankle_row),world(leg_x,ankle_row,18),['front.body.boots','side.body.boot'],'Forward tip inferred within the observed toe depth; not a measured internal joint.')
    components=[{'id':b['id'],'parent':b['parent'],'role':'skinned'} for b in bones]
    meshes={}
    for node in spec['componentTree']:
        if node['material']=='hidden':continue
        cid='surface:'+node['id'];role='detail' if node['id']=='head' else 'hair' if node['id']=='hair' else 'skinned'
        parent='head' if role in ('hair','detail') else 'hips'
        components.append({'id':cid,'parent':parent,'role':role})
        meshes[node['name']]={'componentId':cid,'role':role,'sourceComponent':node['id']}
    sockets={};create_sockets(sockets)
    contract={'schema':'rinne.reference-rig-adaptation/v1','rigFamily':'Rig_Medium','figureHeight':height,'bones':bones,'meshes':meshes,'bindingComponents':components,'voxelResolution':64,'sockets':sockets['sockets'],'sideAuthority':{'left':'Rig_Medium anatomical left; front image right','right':'Rig_Medium anatomical right; front image left'},'geometryChanges':False,'status':'authored inference; binding and actual pose/likeness gates pending'}
    write_json(w/'build/rig/rig-contract.json',contract)
    return contract

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);a=p.parse_args();result=author(a.workspace.resolve());print(json.dumps({'joints':len(result['bones']),'meshes':len(result['meshes']),'status':result['status']}))
