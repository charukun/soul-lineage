const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));

export function downedPresentationSample(row,clipDuration){
 const duration=Math.max(0,Number(clipDuration)||0),state=row?.downedState;
 const progress=state?clamp(state.progress):(row?.downed?1:0);
 const time=duration<=0?0:Math.min(Math.max(0,duration-.000001),progress*duration);
 return Object.freeze({progress,time,phase:state?.phase||(row?.downed?'settled':null),settled:state?.phase==='settled'||(!state&&Boolean(row?.downed))});
}

export function activateSampledDownedAction(mixer,action){
 if(!mixer||!action)return false;
 mixer.stopAllAction();action.reset();action.enabled=true;action.setEffectiveWeight?.(1);action.setEffectiveTimeScale?.(1);action.clampWhenFinished=true;action.play();action.paused=true;return true;
}

export function terminalPresentationState(row,kind){
 const downed=Boolean(row?.downed),dead=Boolean(row?.dead),settled=downed&&(dead||row?.downedState?.phase==='settled');
 const clip=downed?(settled?'Lie_Pose':'Lie_Down'):dead?(kind==='hero'?'Death_A':'Death_C_Skeletons'):null;
 return Object.freeze({downed,dead,settled,clip,removalClock:dead});
}
