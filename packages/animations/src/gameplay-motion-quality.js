const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const finite=(...v)=>v.every(Number.isFinite);

export const MOTION_WARP_PROFILES=Object.freeze({
 slash:Object.freeze({standoff:1.05,maxDistance:.55,turnEnd:.14,warpStart:.18,contact:.50}),
 thrust:Object.freeze({standoff:1.12,maxDistance:.72,turnEnd:.12,warpStart:.15,contact:.52}),
 heavy:Object.freeze({standoff:1.18,maxDistance:.32,turnEnd:.18,warpStart:.24,contact:.55})
});

export function distanceStrideMatch({speed,cycleDistance,clipDuration=1}={}){
 if(!finite(speed,cycleDistance,clipDuration)||cycleDistance<=0||clipDuration<=0)return{playback:1,strideScale:1};
 const ratio=Math.abs(speed)/(cycleDistance/clipDuration);
 return{playback:clamp(ratio,.72,1.28),strideScale:clamp(ratio,.78,1.22)};
}

export function orientationWarp({fromYaw,toYaw,phase,turnEnd=.14}={}){
 if(!finite(fromYaw,toYaw,phase,turnEnd)||turnEnd<=0)throw Error('Invalid orientation warp');
 let delta=(toYaw-fromYaw)%(Math.PI*2);if(delta>Math.PI)delta-=Math.PI*2;if(delta<-Math.PI)delta+=Math.PI*2;
 return fromYaw+delta*smooth(phase/turnEnd);
}

export function collisionClampTravel(wanted,clearance){
 if(!finite(wanted,clearance)||wanted<0)return 0;
 return clamp(clearance,0,wanted);
}

export function selectAttackForRange({distance,angle=0,available=['slash']}={}){
 if(!finite(distance,angle)||!Array.isArray(available)||!available.length)return null;
 const has=x=>available.includes(x);
 if(distance>1.45&&Math.abs(angle)<.55&&has('thrust'))return'thrust';
 if(distance<.82&&has('slash'))return'slash';
 if(distance>1.18&&has('heavy'))return'heavy';
 return has('slash')?'slash':available[0];
}

export function inertializeScalar(previous,current,dt,halfLife=.085){
 if(!finite(previous,current,dt,halfLife)||dt<=0||halfLife<=0)return current;
 return current+(previous-current)*Math.pow(.5,dt/halfLife);
}

export function createImpactBeat({actorId,targetId,kind='slash',clock,serial}={}){
 if(!finite(clock,serial)||serial<0)throw Error('Invalid impact beat');
 return Object.freeze({version:1,id:`${actorId??'actor'}:${targetId??'target'}:${kind}:${serial}`,actorId:actorId??null,targetId:targetId??null,kind,clock,channels:Object.freeze(['hit-stop','camera-impulse','hit-reaction','vfx','sfx'])});
}

export function rootTravelMetadata({kind='slash',forward,standoff,authoritative=false}={}){
 if(!finite(forward,standoff)||forward<0||standoff<0)throw Error('Invalid root travel metadata');
 return Object.freeze({version:1,kind,forward,standoff,units:'world-metres',authoritative:Boolean(authoritative),owner:authoritative?'gameplay':'animation-intent'});
}
