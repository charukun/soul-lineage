function installTitleLiveWorld(){
  const title=document.getElementById('title-screen'),source=document.getElementById('game');
  if(!title||!source)return;
  let raf=0;
  const sync=()=>{
    if(!title.hidden){
      if(source.dataset.titleBeat)title.dataset.cinematicBeat=source.dataset.titleBeat;
      const ready=source.width>1&&source.height>1&&(source.dataset.runtime==='prepared'||source.dataset.cameraMode?.startsWith('title-'));
      if(ready){
        title.dataset.liveWorld='ready';
        title.dataset.liveWorldMode='direct-webgl';
        title.dataset.liveWorldSize=`${source.width}x${source.height}`;
      }
    }
    raf=requestAnimationFrame(sync);
  };
  raf=requestAnimationFrame(sync);
  if(import.meta.hot)import.meta.hot.dispose(()=>cancelAnimationFrame(raf));
}
installTitleLiveWorld();
