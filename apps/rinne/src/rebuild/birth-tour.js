import {muraTopicLine} from '@soul/world/mura/dialogue';

export const BIRTH_TOUR_ORDER=Object.freeze(['garden','home','school','library','chapel','dojo','smith','clinic']);

// The shared village is measured in metres. Village residents walk at 2.8m/s and guards at 4.6m/s;
// keep the passive mother tour inside that life-scale while allowing a small manual-control premium.
export const BIRTH_TOUR_PACE=Object.freeze({autoMin:3.6,autoMax:4.6,manualMin:4.25,manualMax:5.2,manualRatio:1.13});

const distance=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.z||0)-(b?.z||0));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const rounded=value=>Math.round(value*100)/100;

export function birthTourLine(station){return muraTopicLine(station?.topicId,{kind:station?.facilityKind||null});}

export function birthTourStops(stations=[]){
  const byId=new Map((Array.isArray(stations)?stations:[]).filter(row=>row&&typeof row.id==='string').map(row=>[row.id,row]));
  return BIRTH_TOUR_ORDER.map(id=>byId.get(id)).filter(row=>row&&Number.isFinite(row.x)&&Number.isFinite(row.z));
}

export function birthTourPace(stations=[]){
  const stops=birthTourStops(stations),legs=[];
  if(stops.length>1)for(let index=0;index<stops.length;index++){
    const leg=distance(stops[index],stops[(index+1)%stops.length]);if(leg>.8)legs.push(leg);
  }
  legs.sort((a,b)=>a-b);
  const representativeDistance=legs.length?legs[Math.min(legs.length-1,Math.floor((legs.length-1)*.65))]:0;
  const autoSpeed=clamp(representativeDistance/2.4,BIRTH_TOUR_PACE.autoMin,BIRTH_TOUR_PACE.autoMax),manualSpeed=clamp(autoSpeed*BIRTH_TOUR_PACE.manualRatio,BIRTH_TOUR_PACE.manualMin,BIRTH_TOUR_PACE.manualMax);
  return{autoSpeed:rounded(autoSpeed),manualSpeed:rounded(manualSpeed),representativeDistance:rounded(representativeDistance)};
}

export function createBirthTour(stations,{resumeDelay=1.4,dwellSeconds=3.0,arrivalRadius=.82}={}){
  const stops=birthTourStops(stations),spoken=new Set();
  resumeDelay=Math.max(0,finite(resumeDelay,1.4));dwellSeconds=Math.max(.25,finite(dwellSeconds,3));arrivalRadius=Math.max(.25,finite(arrivalRadius,.82));
  let index=0,resumeRemaining=0,dwellRemaining=0,atStopId=null;
  const target=()=>stops.length?stops[index%stops.length]:null;
  function advance(){if(stops.length)index=(index+1)%stops.length;atStopId=null;dwellRemaining=0;return target();}
  function reset(){index=0;resumeRemaining=0;dwellRemaining=0;atStopId=null;spoken.clear();return target();}
  function observe(station){
    const line=birthTourLine(station);if(!line||spoken.has(station.id))return null;
    spoken.add(station.id);return line;
  }
  function tick(dt,position,manualActive=false){
    dt=Math.max(0,Math.min(1,finite(dt)));
    if(manualActive){resumeRemaining=resumeDelay;dwellRemaining=0;atStopId=null;return{mode:'manual',target:null,line:null};}
    if(resumeRemaining>0){resumeRemaining=Math.max(0,resumeRemaining-dt);if(resumeRemaining>0)return{mode:'paused',target:null,line:null};}
    const stop=target();if(!stop)return{mode:'idle',target:null,line:null};
    const radius=Math.max(arrivalRadius,Math.min(1.25,finite(stop.radius,1.8)*.45));
    if(distance(position,stop)>radius){atStopId=null;dwellRemaining=0;return{mode:'travel',target:stop,line:null};}
    let line=null;
    if(atStopId!==stop.id){atStopId=stop.id;dwellRemaining=dwellSeconds;line=observe(stop);}
    else dwellRemaining=Math.max(0,dwellRemaining-dt);
    if(dwellRemaining<=0){const arrived=stop,next=advance();return{mode:'travel',target:next,line,arrived};}
    return{mode:'dwell',target:stop,line,arrived:line?stop:null};
  }
  return{tick,observe,advance,reset,target,stops:()=>stops.slice(),spoken:()=>new Set(spoken)};
}
