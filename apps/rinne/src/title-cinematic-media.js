export const TITLE_MANIFEST_URL='./title-assets/cinematic/manifest.json';
export const TITLE_POSTER_URL='./title-assets/cinematic/landing.webp';

// Media swaps are data-only: movie + matching landing poster + manifest.
export function validateTitleManifest(raw){
  if(!raw||raw.schemaVersion!==1)throw Error('Unsupported title media manifest');
  const asset=value=>typeof value==='string'&&/^\.\/title-assets\/cinematic\/[a-zA-Z0-9._/-]+$/.test(value)&&!value.includes('..');
  if(!asset(raw.poster)||!raw.revision||typeof raw.revision!=='string')throw Error('Invalid title poster/revision');
  for(const key of ['width','height','fps','duration','titleLandingTime','firstVisitSkipTime','returnVisitSkipTime']){
    if(!Number.isFinite(raw[key])||raw[key]<0)throw Error(`Invalid title media ${key}`);
  }
  if(raw.width<320||raw.height<180||raw.fps<1||raw.fps>60||raw.titleLandingTime<=0||raw.duration<raw.titleLandingTime)throw Error('Invalid title media timeline');
  if(raw.firstVisitSkipTime>raw.titleLandingTime||raw.returnVisitSkipTime>raw.firstVisitSkipTime)throw Error('Invalid title skip timing');
  if(!['ready','awaiting-generation'].includes(raw.status))throw Error('Invalid title media status');
  if(raw.status==='ready'&&!asset(raw.movie))throw Error('Ready title movie is missing');
  if(raw.webm&&!asset(raw.webm))throw Error('Invalid title WebM');
  if(raw.portraitFraming){
    if(!Array.isArray(raw.portraitFraming)||!raw.portraitFraming.length)throw Error('Invalid portrait framing');
    let previous=-1;
    for(const frame of raw.portraitFraming){
      if(!frame||!Number.isFinite(frame.time)||frame.time<0||frame.time<=previous||frame.time>raw.titleLandingTime||!Number.isFinite(frame.x)||frame.x<0||frame.x>100)throw Error('Invalid portrait framing');
      previous=frame.time;
    }
  }
  if(raw.livingLoop&&(!Number.isFinite(raw.livingLoop.start)||!Number.isFinite(raw.livingLoop.end)||raw.livingLoop.start<raw.titleLandingTime||raw.livingLoop.end>raw.duration||raw.livingLoop.end<=raw.livingLoop.start))throw Error('Invalid living-still loop');
  return Object.freeze({...raw});
}
