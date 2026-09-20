import {TITLE_MANIFEST_URL,TITLE_POSTER_URL,validateTitleManifest} from './title-cinematic-media.js';

export const createTitleCinematicController=options=>new TitleCinematicController(options);

class TitleCinematicController{
  constructor({title,video,motionToggle,motionKey,getPrepared=()=>null,manifest=null}){
    Object.assign(this,{title,video,motionToggle,motionKey,getPrepared,manifest});
    this.reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.menu=title.querySelector('.title-actions');
    this.active=false;this.started=false;this.returning=false;this.disposed=false;this.seen=false;
    this.frame=0;this.watchdog=0;this.revealTimer=0;this.seekPending=false;this.failed=false;
    this.onTimeUpdate=this.onTimeUpdate.bind(this);this.syncMotion=this.syncMotion.bind(this);this.onVisibility=this.onVisibility.bind(this);
    this.onError=()=>this.fallback('media-error');
    this.onPlaying=()=>{
      if(!this.active||this.failed||this.seekPending)return;
      this.title.dataset.media='video';this.progressTime=this.video.currentTime;this.watch();this.trackFrames();
    };
    this.onMetadata=()=>{if(this.seekPending)this.seekLanding();};
    this.onSeeked=()=>{
      if(!this.active||!this.seekPending||this.video.currentTime<this.landingFrame()-.1)return;
      this.seekPending=false;this.title.dataset.media='video';
      this.syncFraming();
      if(this.manifest.livingLoop&&this.motionAllowed())this.play();else this.video.pause();
    };
    this.onEnded=()=>{if(this.active&&!this.failed){this.land();if(this.manifest.livingLoop)this.seekLanding();}};
  }
  motionAllowed(){return this.title.dataset.motion==='on'&&!this.reducedMotion?.matches;}
  setPhase(phase){
    this.title.dataset.intro=phase;
    if(this.menu){this.menu.inert=phase!=='idle';this.menu.setAttribute('aria-hidden',String(phase!=='idle'));}
  }
  markSeen(){this.seen=true;if(this.seenKey)try{localStorage.setItem(this.seenKey,'1');}catch{}}
  clear(){
    clearTimeout(this.watchdog);clearTimeout(this.revealTimer);this.watchdog=0;this.revealTimer=0;
    if(this.frame)this.video.cancelVideoFrameCallback?.(this.frame);this.frame=0;
  }
  pause(){this.active=false;this.returning=true;this.clear();this.video.pause();this.getPrepared()?.stopTitlePreview?.();}
  fallback(reason){
    this.failed=true;this.clear();this.video.pause();this.seekPending=false;
    this.title.dataset.media='poster';this.title.dataset.mediaStatus=reason;this.title.dataset.skip='done';this.setPhase('idle');
    this.getPrepared()?.stopTitlePreview?.();
  }
  async init(){
    const {video}=this;video.muted=true;video.playsInline=true;video.preload='none';video.poster=TITLE_POSTER_URL;
    this.listeners=[['timeupdate',this.onTimeUpdate],['playing',this.onPlaying],['loadedmetadata',this.onMetadata],['error',this.onError],['ended',this.onEnded],['seeked',this.onSeeked]];
    for(const [event,fn]of this.listeners)video.addEventListener(event,fn);
    this.reducedMotion?.addEventListener?.('change',this.syncMotion);document.addEventListener('visibilitychange',this.onVisibility);
    let motion=!this.reducedMotion?.matches;try{if(localStorage.getItem(this.motionKey)==='off')motion=false;}catch{}
    this.setMotion(motion);
    try{
      if(!this.manifest){
        this.manifestAbort=new AbortController();const timer=setTimeout(()=>this.manifestAbort.abort(),4500);
        try{const response=await fetch(TITLE_MANIFEST_URL,{signal:this.manifestAbort.signal,cache:'no-cache'});if(!response.ok)throw Error('Title manifest unavailable');this.manifest=await response.json();}finally{clearTimeout(timer);}
      }
      this.manifest=validateTitleManifest(this.manifest);if(this.disposed)return;
      const m=this.manifest;this.syncFraming(0);this.seenKey=`${this.motionKey}:film-seen:${m.revision}`;
      try{this.seen=localStorage.getItem(this.seenKey)==='1';}catch{}
      video.poster=m.poster;const poster=this.title.querySelector('.title-world-base');if(poster)poster.src=m.poster;
      this.title.dataset.mediaRevision=m.revision;this.title.dataset.mediaStatus=m.status;
      video.width=m.width;video.height=m.height;
      if(this.active)this.begin();
    }catch{if(!this.disposed)this.fallback('manifest-unavailable');}
  }
  begin(){
    if(this.disposed||this.title.hidden)return;
    this.active=true;this.getPrepared()?.stopTitlePreview?.();
    if(this.failed)return;
    if(!this.manifest){this.setPhase('pending');this.title.dataset.media='poster';return;}
    if(!this.motionAllowed()||this.manifest.status!=='ready'){this.fallback(this.manifest.status==='ready'?'reduced-motion':'awaiting-generation');return;}
    if(this.returning){this.returning=false;this.land({seek:true,immediate:true});return;}
    if(this.started)return;
    this.started=true;this.setPhase('cinematic');this.title.focus?.({preventScroll:true});this.title.dataset.skip=this.seen?'ready':'locked';
    const m=this.manifest;
    this.video.src=m.webm&&this.video.canPlayType('video/webm')?m.webm:m.movie;
    this.video.preload='auto';this.video.load();this.progressTime=0;this.watch();this.play();
  }
  play(){
    if(!this.active||this.disposed||this.failed||document.hidden)return;
    try{Promise.resolve(this.video.play()).catch(()=>{if(this.active&&!this.video.paused)this.fallback('autoplay-blocked');else if(this.active&&!this.seekPending&&this.title.dataset.intro==='cinematic')this.fallback('autoplay-blocked');});}catch{this.fallback('autoplay-blocked');}
  }
  watch(){
    clearTimeout(this.watchdog);
    this.watchdog=setTimeout(()=>{
      if(!this.active||this.disposed||this.failed||document.hidden)return;
      if(this.video.currentTime===this.progressTime&&!this.video.ended){this.fallback('media-timeout');return;}
      this.progressTime=this.video.currentTime;this.watch();
    },4500);
  }
  trackFrames(){
    if(this.frame||!this.video.requestVideoFrameCallback)return;
    this.frame=this.video.requestVideoFrameCallback(()=>{this.frame=0;this.onTimeUpdate();if(this.active&&!this.failed&&!this.video.paused)this.trackFrames();});
  }
  onTimeUpdate(){
    if(!this.active||!this.manifest||this.failed||this.seekPending)return;
    this.syncFraming();
    const m=this.manifest,t=this.video.currentTime;
    if(this.title.dataset.intro==='cinematic'){
      if(t>=(this.seen?m.returnVisitSkipTime:m.firstVisitSkipTime))this.title.dataset.skip='ready';
      if(t>=m.titleLandingTime)this.land();
    }
    if(this.title.dataset.intro!=='cinematic'&&m.livingLoop&&t>=m.livingLoop.end-1/m.fps)this.video.currentTime=m.livingLoop.start;
  }
  syncFraming(time=this.video.currentTime){
    const frame=this.manifest?.portraitFraming?.findLast(frame=>time>=frame.time);
    this.video.style?.setProperty('--title-video-position',`${frame?.x??50}% 50%`);
  }
  landingFrame(){return this.manifest.livingLoop?.start??Math.min(this.manifest.titleLandingTime,this.manifest.duration-1/this.manifest.fps);}
  seekLanding(){
    this.seekPending=true;
    if(this.video.readyState<1)return;
    try{
      if(Math.abs(this.video.currentTime-this.landingFrame())<.01){this.onSeeked();return;}
      this.video.currentTime=this.landingFrame();
    }catch{this.fallback('seek-unavailable');}
  }
  land({seek=false,immediate=false}={}){
    if(!this.active||this.disposed||this.failed)return;
    this.markSeen();this.title.dataset.skip='done';
    if(this.title.dataset.intro!=='idle'){
      this.setPhase(immediate?'idle':'settling');clearTimeout(this.revealTimer);
      if(!immediate)this.revealTimer=setTimeout(()=>{if(this.active)this.setPhase('idle');},650);
    }
    if(seek){this.title.dataset.media='landing';this.video.pause();this.seekLanding();}
    if(!this.manifest.livingLoop){this.video.pause();clearTimeout(this.watchdog);}
    else{this.progressTime=-1;this.watch();if(!this.seekPending)this.play();}
  }
  skip(){
    if(!this.active||this.title.dataset.intro!=='cinematic'||this.title.dataset.skip!=='ready')return false;
    this.land({seek:true});return true;
  }
  onPrepared(){this.getPrepared()?.stopTitlePreview?.();}
  onVisibility(){
    if(!this.active||this.failed)return;
    if(document.hidden){this.video.pause();this.clear();return;}
    if(this.title.dataset.intro==='settling')this.setPhase('idle');
    if(this.motionAllowed()&&this.manifest?.status==='ready'&&(this.title.dataset.intro==='cinematic'||this.manifest.livingLoop)){this.progressTime=-1;this.watch();this.play();}
  }
  syncMotion(){
    if(!this.active)return;
    if(!this.motionAllowed()){this.fallback('reduced-motion');return;}
    if(this.manifest?.status==='ready'&&this.title.dataset.mediaStatus==='reduced-motion'){
      this.failed=false;this.title.dataset.mediaStatus='ready';
      if(!this.started){this.begin();this.land({seek:true,immediate:true});}else this.land({seek:true,immediate:true});
    }
  }
  setMotion(enabled,persist=false){
    this.title.dataset.motion=enabled?'on':'off';this.motionToggle.setAttribute('aria-checked',String(enabled));
    const state=this.motionToggle.querySelector('.setting-switch-state');if(state)state.textContent=enabled?'入':'切';
    if(persist)try{localStorage.setItem(this.motionKey,enabled?'on':'off');}catch{}
    this.syncMotion();
  }
  dispose(){
    this.disposed=true;this.pause();this.manifestAbort?.abort();
    for(const [event,fn]of this.listeners??[])this.video.removeEventListener(event,fn);
    this.reducedMotion?.removeEventListener?.('change',this.syncMotion);document.removeEventListener('visibilitychange',this.onVisibility);
    this.video.removeAttribute('src');this.video.load();
  }
}
