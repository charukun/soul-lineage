import {swordSequenceTravel,swordSequencePelvisZ} from '../../public/simulator/src/sword-sequence.js';

/** Apply the shared controller travel to the Lab's unnormalized display root. */
export function applyReviewSwordTravel(root,origin,sequence,time,{poseScale,displayScale=[1,1,1],inPlace=false}={}){
  root.position.copy(origin);
  if(sequence&&poseScale!=null){
    const move=inPlace?{x:0,z:-swordSequencePelvisZ(sequence,time)*poseScale}:swordSequenceTravel(sequence,time,poseScale);
    root.position.x+=move.x*displayScale[0];
    root.position.z+=move.z*displayScale[2];
  }
  root.updateMatrixWorld(true);
}
