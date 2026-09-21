export function createReviewWarmup({routes,assetBase,order=[],assetPaths=[],doc=document,scope=globalThis}={}){
  const warmed=new Set(),connected=new Set();

  function warmRoute(id,{eager=false}={}){
    const href=routes?.[id];
    if(!href||warmed.has(href))return;
    const url=new URL(href);
    if(!connected.has(url.origin)){
      const preconnect=doc.createElement('link');
      preconnect.rel='preconnect';
      preconnect.href=url.origin;
      preconnect.crossOrigin='anonymous';
      doc.head.append(preconnect);
      connected.add(url.origin);
    }
    const prefetch=doc.createElement('link');
    prefetch.rel='prefetch';
    prefetch.as='document';
    prefetch.href=href;
    prefetch.dataset.reviewWarm=id;
    if(eager)prefetch.fetchPriority='high';
    doc.head.append(prefetch);
    warmed.add(href);
  }

  function warmAssets(){
    for(const path of assetPaths){
      const href=new URL(path,assetBase).href;
      if(warmed.has(href))continue;
      const prefetch=doc.createElement('link');
      prefetch.rel='prefetch';
      prefetch.href=href;
      prefetch.fetchPriority='low';
      prefetch.dataset.reviewWarmAsset='vfx';
      doc.head.append(prefetch);
      warmed.add(href);
    }
  }

  function schedule(callback){
    if(scope.requestIdleCallback)scope.requestIdleCallback(callback,{timeout:900});
    else scope.setTimeout(callback,120);
  }

  function start(){
    let index=0;
    const next=()=>{
      if(index>=order.length)return;
      warmRoute(order[index]);
      index++;
      schedule(next);
    };
    if(order.length)warmRoute(order[index++],{eager:true});
    warmAssets();
    schedule(next);
  }

  return Object.freeze({warmRoute,start});
}
