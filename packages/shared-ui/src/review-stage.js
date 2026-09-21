const make=(tag,cls='',text='')=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node};

export function mountReviewStageControls({stage=document.querySelector('.review-surface__stage'),groups=[],label='表示・再生コントロール'}={}){
  if(!stage||stage.querySelector('[data-review-stage-controls]'))return null;
  const nodes=groups
    .flatMap(selector=>[...document.querySelectorAll(selector)])
    .filter((node,index,all)=>node&&!all.slice(0,index).some(parent=>parent.contains(node)));
  const root=make('div','review-stage-controls');
  root.dataset.reviewStageControls='true';
  const button=make('button','review-stage-controls__button','⚙');
  button.type='button';
  button.title=label;
  button.setAttribute('aria-label',label);
  button.setAttribute('aria-expanded','false');
  const panel=make('div','review-stage-controls__panel');
  panel.id='review-stage-controls-panel';
  panel.hidden=true;
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-label',label);
  button.setAttribute('aria-controls',panel.id);
  const title=make('strong','review-stage-controls__title',label);
  panel.append(title,...nodes);
  root.append(panel,button);
  stage.append(root);
  const setOpen=open=>{panel.hidden=!open;root.dataset.open=String(open);button.setAttribute('aria-expanded',String(open));};
  button.addEventListener('click',event=>{event.stopPropagation();setOpen(panel.hidden)});
  const outside=event=>{if(!panel.hidden&&!root.contains(event.target))setOpen(false)};
  const escape=event=>{if(event.key==='Escape'&&!panel.hidden){setOpen(false);button.focus()}};
  document.addEventListener('pointerdown',outside,true);
  document.addEventListener('keydown',escape);
  return{
    root,
    destroy(){
      document.removeEventListener('pointerdown',outside,true);
      document.removeEventListener('keydown',escape);
      for(const node of nodes)node.remove();
      root.remove();
    },
  };
}

export function createReviewStageLifecycle({canvas,stage=canvas?.closest('.review-surface__stage')||canvas?.parentElement,onResize,render,win=window}={}){
  if(!canvas||!stage||typeof onResize!=='function')throw new Error('Review stage lifecycle requires canvas, stage and onResize');
  let raf=0,destroyed=false,lastWidth=0,lastHeight=0;
  const apply=()=>{
    raf=0;
    if(destroyed)return false;
    const rect=stage.getBoundingClientRect(),width=Math.floor(stage.clientWidth),height=Math.floor(stage.clientHeight);
    if(width<2||height<2)return false;
    if(width===lastWidth&&height===lastHeight)return false;
    lastWidth=width;
    lastHeight=height;
    onResize({width,height,aspect:width/height,rect});
    render?.();
    return true;
  };
  const refresh=()=>{if(destroyed||raf)return;raf=win.requestAnimationFrame(apply)};
  const observer=new win.ResizeObserver(refresh);
  observer.observe(stage);
  win.addEventListener('resize',refresh,{passive:true});
  win.addEventListener('orientationchange',refresh,{passive:true});
  win.visualViewport?.addEventListener('resize',refresh,{passive:true});
  refresh();
  return Object.freeze({
    refresh,
    get size(){return Object.freeze({width:lastWidth,height:lastHeight})},
    destroy(){
      if(destroyed)return;
      destroyed=true;
      observer.disconnect();
      if(raf)win.cancelAnimationFrame(raf);
      win.removeEventListener('resize',refresh);
      win.removeEventListener('orientationchange',refresh);
      win.visualViewport?.removeEventListener('resize',refresh);
    },
  });
}
