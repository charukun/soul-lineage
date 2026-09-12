import { installPostureWeaponPreview } from './posture-preview.js';
import { installWeaponReviewPolish } from './weapon-review-polish.js';
import { reviewPresets, reviewWeapons, disposeLoaded, installReviewExtensions as installBase } from './review-adapter-base.js';
export { reviewPresets, reviewWeapons, disposeLoaded };

const lowerBodyNames=['leftUpperLeg','leftLowerLeg','leftFoot','leftToes','rightUpperLeg','rightLowerLeg','rightFoot','rightToes'];
function polishedThrust(clip,body,restHips){
  const out=clip.clone();
  const lowerIds=new Set(lowerBodyNames.map(name=>body.bones?.[name]?.uuid).filter(Boolean));
  out.tracks=out.tracks.filter(track=>!lowerIds.has(track.name.split('.')[0]));
  const hipsId=body.bones?.hips?.uuid;
  const hipsPosition=out.tracks.find(track=>track.name===`${hipsId}.position`);
  if(hipsPosition&&restHips){
    for(let i=0;i<hipsPosition.values.length;i+=3){
      const phase=hipsPosition.times[Math.floor(i/3)]/Math.max(out.duration,.001);
      const drive=Math.sin(Math.min(1,Math.max(0,phase))*Math.PI);
      hipsPosition.values[i]=restHips.x;
      hipsPosition.values[i+1]=restHips.y-.035*drive;
      hipsPosition.values[i+2]=restHips.z+.045*drive;
    }
  }
  out.name='技 / 刺し貫く';
  out.resetDuration();
  return out;
}

export async function installReviewExtensions(options){
  const base=await installBase(options);
  return {...base,async loadPreset(args){
    const body=installPostureWeaponPreview(installWeaponReviewPolish(await base.loadPreset(args)));
    const originalGet=body.getClip?.bind(body),slashCache=new WeakMap(),thrustCache=new WeakMap();
    const restHips=body.bones?.hips?.position?.clone?.()||null;
    body.getClip=(name,opts)=>{
      const clip=originalGet?.(name,opts);if(!clip)return clip;
      if(name==='技 / 流し斬り'){
        if(!slashCache.has(clip)){const stretched=clip.clone();for(const track of stretched.tracks)track.scale(1.28);stretched.resetDuration();slashCache.set(clip,stretched);}return slashCache.get(clip);
      }
      if(name==='技 / 刺し貫く'){
        const meta=body.motionMeta?.get(name);if(meta&&!meta.phases)meta.phases=[['構え',0],['踏み込み',.24],['貫き',.52],['引き戻し',.78]];
        if(!thrustCache.has(clip))thrustCache.set(clip,polishedThrust(clip,body,restHips));
        return thrustCache.get(clip);
      }
      return clip;
    };
    return body;
  }};
}
