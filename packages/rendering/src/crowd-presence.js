import {CylinderGeometry,SphereGeometry,MeshStandardMaterial,InstancedMesh,Matrix4,Quaternion,Vector3,Color} from 'three';

export function createCrowdPresenceRenderer(scene,{capacity=256,bodyColor=0x66715f,headColor=0xc7aa8d}={}){
  const bodyGeometry=new CylinderGeometry(.28,.34,1.15,5,1),headGeometry=new SphereGeometry(.24,5,3);
  const bodyMaterial=new MeshStandardMaterial({color:new Color(bodyColor),roughness:.88}),headMaterial=new MeshStandardMaterial({color:new Color(headColor),roughness:.82});
  const body=new InstancedMesh(bodyGeometry,bodyMaterial,capacity),head=new InstancedMesh(headGeometry,headMaterial,capacity);
  body.name='CrowdPresenceBody';head.name='CrowdPresenceHead';body.castShadow=head.castShadow=false;body.receiveShadow=head.receiveShadow=true;
  body.frustumCulled=head.frustumCulled=true;body.userData.runtimeOwned=head.userData.runtimeOwned=true;
  scene.add(body,head);let count=0;const matrix=new Matrix4(),position=new Vector3(),scale=new Vector3(),rotation=new Quaternion();
  return {
    update(rows=[]){count=0;for(const row of rows){if(count>=capacity)break;if(!['proxy','impostor'].includes(row.crowdMode))continue;position.set(Number(row.x)||0,.58,Number(row.z)||0);scale.set(1,1,1);matrix.compose(position,rotation,scale);body.setMatrixAt(count,matrix);position.y=1.35;matrix.compose(position,rotation,scale);head.setMatrixAt(count,matrix);count++;}body.count=head.count=count;body.instanceMatrix.needsUpdate=head.instanceMatrix.needsUpdate=true;return count;},
    snapshot(){return Object.freeze({count,capacity,drawCalls:count?2:0});},
    dispose(){scene.remove(body,head);bodyGeometry.dispose();headGeometry.dispose();bodyMaterial.dispose();headMaterial.dispose();body.dispose?.();head.dispose?.();},
  };
}

export function applyCrowdPlanToActors(actors,plan){
  const byId=new Map((plan||[]).map(row=>[String(row.id),row]));let applied=0,proxied=0;
  for(const actor of actors||[]){const id=String(actor.userData?.presenceId||actor.userData?.actorId||actor.name||actor.uuid),row=byId.get(id);if(!row)continue;actor.userData.worldScale=row;actor.userData.crowdAnimationHz=row.animationHz;actor.userData.networkPresenceHz=row.networkHz;actor.userData.audioLOD=row.audioMode;applied++;
    if(actor.userData?.crowdProxyEligible===true){const proxy=['proxy','impostor','hidden'].includes(row.crowdMode);actor.visible=!proxy;actor.userData.crowdProxyActive=proxy;if(proxy)proxied++;}
  }
  return Object.freeze({applied,proxied});
}
