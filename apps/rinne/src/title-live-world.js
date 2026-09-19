function installTitleLiveWorld(){
  const title=document.getElementById('title-screen'),source=document.getElementById('game'),world=title?.querySelector('.title-world');
  if(!title||!source||!world||world.querySelector('.title-live-canvas'))return;
  world.style.backgroundImage="url('./title-assets/world.webp')";world.style.backgroundSize='cover';world.style.backgroundPosition='51% 50%';
  const canvas=document.createElement('canvas');canvas.className='title-live-canvas';canvas.setAttribute('aria-hidden','true');world.prepend(canvas);
  const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});if(!ctx)return;
  let raf=0,lastSize='',hasFrame=false;
  const visibleCapture=(w,h)=>{try{const points=[[.25,.3],[.5,.5],[.75,.7]];return points.some(([x,y])=>{const pixel=ctx.getImageData(Math.floor(w*x),Math.floor(h*y),1,1).data;return pixel[0]+pixel[1]+pixel[2]>36;});}catch{return true;}};
  const draw=()=>{
    if(!title.hidden&&source.width>1&&source.height>1){
      const rect=title.getBoundingClientRect(),scale=title.dataset.media==='realtime'&&title.dataset.intro==='cinematic'?.58:Math.min(1.25,window.devicePixelRatio||1),w=Math.max(2,Math.round(rect.width*scale)),h=Math.max(2,Math.round(rect.height*scale)),size=`${w}x${h}`;
      if(size!==lastSize){canvas.width=w;canvas.height=h;lastSize=size;}
      try{
        const sourceRatio=source.width/source.height,targetRatio=w/h;let sx=0,sy=0,sw=source.width,sh=source.height;
        if(sourceRatio>targetRatio){sw=Math.round(source.height*targetRatio);sx=Math.round((source.width-sw)*.5);}else{sh=Math.round(source.width/targetRatio);sy=Math.round((source.height-sh)*.5);}
        ctx.drawImage(source,sx,sy,sw,sh,0,0,w,h);
        if(!hasFrame&&visibleCapture(w,h)){hasFrame=true;title.dataset.liveWorld='ready';}
      }catch{}
    }
    raf=requestAnimationFrame(draw);
  };
  raf=requestAnimationFrame(draw);
  if(import.meta.hot)import.meta.hot.dispose(()=>cancelAnimationFrame(raf));
}

installTitleLiveWorld();
