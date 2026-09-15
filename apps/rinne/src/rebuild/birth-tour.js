export const BIRTH_TOUR_ORDER=Object.freeze(['garden','home','school','library','chapel','dojo','smith','clinic']);

export const BIRTH_TOUR_LINES=Object.freeze({
  garden:'ここは広場。遊んだり、村のみんなが顔を合わせたりする場所よ。',
  home:'ここが家。朝も夜も、みんなここへ帰ってくるのよ。',
  school:'ここは学び舎。文字や、昔のことを教わるの。',
  library:'本には、会ったことのない人の知恵まで残っているのよ。',
  chapel:'ここでは旅の無事を祈るの。遠くへ出る人も、帰ってきた人もね。',
  dojo:'ここは稽古場。身体の使い方を覚える場所よ。',
  smith:'ここは鍛冶場。七歳になれば、あなたもここで武具を手にできるわ。',
  clinic:'けがをしたらここへ。戻って休むことも、暮らしの大事な一部よ。',
});

const distance=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.z||0)-(b?.z||0));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

export function birthTourLine(station){return station?.id&&Object.hasOwn(BIRTH_TOUR_LINES,station.id)?BIRTH_TOUR_LINES[station.id]:null;}

export function birthTourStops(stations=[]){
  const byId=new Map((Array.isArray(stations)?stations:[]).filter(row=>row&&typeof row.id==='string').map(row=>[row.id,row]));
  return BIRTH_TOUR_ORDER.map(id=>byId.get(id)).filter(row=>row&&Number.isFinite(row.x)&&Number.isFinite(row.z));
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
