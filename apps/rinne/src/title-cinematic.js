import { TITLE_CINEMATIC_META, TITLE_VIDEO_URL, TITLE_POSTER_URL } from './title-cinematic-media.js';

export function createTitleCinematicController(options){
  return new TitleCinematicController(options);
}

class TitleCinematicController{
  constructor({title,video,motionToggle,motionKey,getPrepared=()=>null,resetParallax=()=>{}}){
    this.title=title;this.video=video;this.motionToggle=motionToggle;this.motionKey=motionKey;
    this.getPrepared=getPrepared;this.resetParallax=resetParallax;
    this.reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.introPlayed=false;this.introSettled=false;this.mediaFailed=false;this.disposed=false;
    this.timers=[];this.frameRequest=0;this.pendingSeek=null;this.transitionHandler=null;
    for(const name of ['onLoadedMetadata','onLoaded','onCanPlay','onPlaying','onTimeUpdate','onEnded','onError','syncMotion']){
      this[name]=this[name].bind(this);
    }
  }
  prefersReducedMotion(){return Boolean(this.reducedMotion?.matches);}
  clearTimers(){
    for(const timer of this.timers)clearTimeout(timer);
    this.timers=[];
    if(this.transitionHandler){
      this.title.querySelector('.title-lockup')?.removeEventListener('transitionend',this.transitionHandler);
      this.transitionHandler=null;
    }
  }
  fallbackPreview(){this.getPrepared()?.startTitlePreview?.({cinematic:false});}
  pause(){this.video.pause();}
  safeSeek(time){
    if(this.video.readyState>0){
      try{this.video.currentTime=time;this.pendingSeek=null;return true;}catch{}
    }
    this.pendingSeek=time;return false;
  }
  play(){
    if(this.mediaFailed)return;
    const promise=this.video.play();
    promise?.then?.(()=>this.scheduleFrame()).catch?.(error=>{
      if(error?.name!=='AbortError'&&!this.title.hidden)this.activateFallback(error);
    });
  }
  seekToLivingStill({play=true}={}){
    if(this.mediaFailed){
      this.title.dataset.media='fallback';this.fallbackPreview();return;
    }
    this.safeSeek(TITLE_CINEMATIC_META.introEnd);this.title.dataset.media='video';
    if(play&&this.title.dataset.motion==='on'&&!this.prefersReducedMotion()&&!this.title.hidden)this.play();
    else this.video.pause();
  }
  settleUi(){
    if(this.title.hidden||this.title.dataset.intro==='settling'||this.title.dataset.intro==='idle')return;
    this.clearTimers();this.introSettled=true;this.title.dataset.intro='settling';
    let complete=false;
    const finish=()=>{
      if(complete||this.title.hidden)return;
      complete=true;this.transitionHandler=null;this.title.dataset.intro='idle';
    };
    this.transitionHandler=event=>{
      if(event.propertyName==='opacity'||event.propertyName==='transform')finish();
    };
    this.title.querySelector('.title-lockup')?.addEventListener('transitionend',this.transitionHandler,{once:true});
    this.timers.push(setTimeout(finish,1500));
  }
  activateFallback(reason){
    if(this.mediaFailed&&this.title.dataset.media==='fallback')return;
    this.mediaFailed=true;
    if(reason)console.warn('Cinematic title fallback',reason);
    this.pause();this.title.dataset.media='fallback';this.fallbackPreview();
    if(this.title.dataset.intro!=='idle')this.settleUi();
  }
  handleMediaTime(mediaTime){
    if(!this.introSettled&&this.title.dataset.intro==='cinematic'&&mediaTime>=TITLE_CINEMATIC_META.introEnd-.04)this.settleUi();
    if(this.title.dataset.media==='video'&&mediaTime>=TITLE_CINEMATIC_META.duration-.10){
      this.safeSeek(TITLE_CINEMATIC_META.introEnd);
      if(this.title.dataset.motion==='on'&&!this.prefersReducedMotion()&&!this.title.hidden)this.play();
    }
  }
  onVideoFrame(_now,metadata){
    this.frameRequest=0;this.title.dataset.videoFrame='ready';
    this.handleMediaTime(metadata?.mediaTime??this.video.currentTime);this.scheduleFrame();
  }
  scheduleFrame(){
    if(this.disposed||this.video.paused||this.frameRequest||typeof this.video.requestVideoFrameCallback!=='function')return;
    this.frameRequest=this.video.requestVideoFrameCallback((now,metadata)=>this.onVideoFrame(now,metadata));
  }
  onLoadedMetadata(){
    if(this.pendingSeek!=null){
      const seek=this.pendingSeek;this.pendingSeek=null;this.safeSeek(seek);
    }
  }
  onLoaded(){this.title.dataset.videoReady='true';}
  onCanPlay(){
    this.title.dataset.videoReady='true';
    if(this.title.dataset.intro==='cinematic'&&!this.title.hidden&&this.video.paused&&this.title.dataset.motion==='on'&&!this.prefersReducedMotion())this.play();
  }
  onPlaying(){this.title.dataset.media='video';this.scheduleFrame();}
  onTimeUpdate(){this.handleMediaTime(this.video.currentTime);}
  onEnded(){
    if(this.title.hidden)return;
    this.safeSeek(TITLE_CINEMATIC_META.introEnd);
    if(this.title.dataset.motion==='on'&&!this.prefersReducedMotion())this.play();else this.video.pause();
  }
  onError(){if(!this.title.hidden)this.activateFallback(this.video.error||new Error('title media error'));}
  begin(){
    if(this.introPlayed){
      if(this.title.dataset.intro==='cinematic'||this.title.dataset.intro==='settling')return;
      this.introSettled=true;this.title.dataset.intro='idle';this.seekToLivingStill({play:true});return;
    }
    this.introPlayed=true;this.introSettled=false;this.clearTimers();
    if(this.title.dataset.motion!=='on'||this.prefersReducedMotion()){
      this.introSettled=true;this.title.dataset.intro='idle';this.seekToLivingStill({play:false});return;
    }
    this.title.dataset.intro='cinematic';this.title.dataset.media='pending';this.safeSeek(0);
    this.timers.push(setTimeout(()=>{
      if(!this.title.hidden&&this.title.dataset.intro==='cinematic'&&this.video.readyState<2)this.activateFallback(new Error('intro load timeout'));
    },3200));
    this.play();
  }
  syncMotion(){
    if(this.title.hidden)return;
    const allowed=this.title.dataset.motion==='on'&&!this.prefersReducedMotion();
    if(!allowed){
      this.clearTimers();this.introPlayed=true;this.introSettled=true;this.title.dataset.intro='idle';
      this.seekToLivingStill({play:false});this.resetParallax();return;
    }
    if(this.title.dataset.intro==='idle')this.seekToLivingStill({play:true});
  }
  setMotion(enabled,persist=false){
    this.title.dataset.motion=enabled?'on':'off';this.motionToggle.setAttribute('aria-checked',String(enabled));
    const state=this.motionToggle.querySelector('.setting-switch-state');if(state)state.textContent=enabled?'入':'切';
    if(!enabled)this.resetParallax();
    if(persist){try{localStorage.setItem(this.motionKey,enabled?'on':'off');}catch{}}
    this.syncMotion();
  }
  init(){
    this.disposed=false;this.video.muted=true;this.video.playsInline=true;
    this.video.poster=TITLE_POSTER_URL;this.video.src=TITLE_VIDEO_URL;
    this.video.addEventListener('loadedmetadata',this.onLoadedMetadata);
    this.video.addEventListener('loadeddata',this.onLoaded);
    this.video.addEventListener('canplay',this.onCanPlay);
    this.video.addEventListener('playing',this.onPlaying);
    this.video.addEventListener('timeupdate',this.onTimeUpdate);
    this.video.addEventListener('ended',this.onEnded);
    this.video.addEventListener('error',this.onError);
    this.reducedMotion?.addEventListener?.('change',this.syncMotion);
    let initial=!this.prefersReducedMotion();
    try{
      const stored=localStorage.getItem(this.motionKey);
      if(!this.prefersReducedMotion()&&(stored==='on'||stored==='off'))initial=stored==='on';
    }catch{}
    this.setMotion(initial);this.video.load();
  }
  dispose(){
    if(this.disposed)return;
    this.disposed=true;this.clearTimers();this.pause();
    if(this.frameRequest&&typeof this.video.cancelVideoFrameCallback==='function')this.video.cancelVideoFrameCallback(this.frameRequest);
    this.frameRequest=0;
    this.video.removeEventListener('loadedmetadata',this.onLoadedMetadata);
    this.video.removeEventListener('loadeddata',this.onLoaded);
    this.video.removeEventListener('canplay',this.onCanPlay);
    this.video.removeEventListener('playing',this.onPlaying);
    this.video.removeEventListener('timeupdate',this.onTimeUpdate);
    this.video.removeEventListener('ended',this.onEnded);
    this.video.removeEventListener('error',this.onError);
    this.reducedMotion?.removeEventListener?.('change',this.syncMotion);
  }
}
