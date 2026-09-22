export function clearBrowserMediaSession(mediaSession=globalThis.navigator?.mediaSession){
  if(!mediaSession)return;
  try{mediaSession.playbackState='none';}catch{}
  try{mediaSession.metadata=null;}catch{}
}

export function relinquishMediaElement(player,{mediaSession=globalThis.navigator?.mediaSession}={}){
  let position=0,hadSource=false,wasPlaying=false;
  if(player){
    try{position=Number.isFinite(player.currentTime)?Math.max(0,player.currentTime):0;}catch{}
    try{hadSource=Boolean(player.getAttribute?.('src')||player.src);}catch{}
    try{wasPlaying=!player.paused;}catch{}
    try{player.pause?.();}catch{}
    if(hadSource){
      try{
        if(player.removeAttribute)player.removeAttribute('src');
        else player.src='';
      }catch{try{player.src='';}catch{}}
      try{player.load?.();}catch{}
    }
  }
  clearBrowserMediaSession(mediaSession);
  return {position,hadSource,wasPlaying};
}

export function restoreMediaElement(player,{src,position=0,loop}={}){
  if(!player||!src)return false;
  try{
    player.src=src;
    if(loop!==undefined)player.loop=Boolean(loop);
    player.load?.();
    const target=Number.isFinite(position)?Math.max(0,position):0;
    const seek=()=>{if(target<=0)return;try{player.currentTime=target;}catch{}};
    seek();
    if(target>0&&Number(player.readyState||0)<1)player.addEventListener?.('loadedmetadata',seek,{once:true});
    return true;
  }catch{return false;}
}
