function installTitleLiveWorld(){
  const title=document.getElementById('title-screen'),source=document.getElementById('game'),world=title?.querySelector('.title-world');
  if(!title||!source||!world||world.querySelector('.title-live-canvas'))return;
  const canvas=document.createElement('canvas');canvas.className='title-live-canvas';canvas.setAttribute('aria-hidden','true');world.prepend(canvas);
  const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});if(!ctx)return;
  let raf=0,lastSize='',hasFrame=false;
  const draw=()=>{
    if(!title.hidden&&source.width>1&&source.height>1){
      const rect=title.getBoundingClientRect(),scale=Math.min(1.25,window.devicePixelRatio||1),w=Math.max(2,Math.round(rect.width*scale)),h=Math.max(2,Math.round(rect.height*scale)),size=`${w}x${h}`;
      if(size!==lastSize){canvas.width=w;canvas.height=h;lastSize=size;}
      try{
        const sourceRatio=source.width/source.height,targetRatio=w/h;let sx=0,sy=0,sw=source.width,sh=source.height;
        if(sourceRatio>targetRatio){sw=Math.round(source.height*targetRatio);sx=Math.round((source.width-sw)*.5);}else{sh=Math.round(source.width/targetRatio);sy=Math.round((source.height-sh)*.5);}
        ctx.drawImage(source,sx,sy,sw,sh,0,0,w,h);
        if(!hasFrame){hasFrame=true;title.dataset.liveWorld='ready';}
      }catch{}
    }
    raf=requestAnimationFrame(draw);
  };
  raf=requestAnimationFrame(draw);
  if(import.meta.hot)import.meta.hot.dispose(()=>cancelAnimationFrame(raf));
}

installTitleLiveWorld();
