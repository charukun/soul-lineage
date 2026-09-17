import {createAuthoredEffectPlayer} from './authored-effect-player.js';
import {authoredEffectBase,createEffekseerBackend} from './effekseer-loader.js';

/** Install into the existing scene pass, including its HDR/depth/focus target. */
export function installCombatEffects(view,{document,canvas,backendFactory=createEffekseerBackend}={}){
  const T=view.THREE,win=document.defaultView||globalThis;
  const mobile=Boolean(win.matchMedia?.('(pointer: coarse)').matches);
  const motion=win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const baseUrl=authoredEffectBase(document),abort=new AbortController();
  const player=createAuthoredEffectPlayer({mobile,reducedMotion:Boolean(motion?.matches)});
  let disposed=false,booted=false,front=null;
  const geometry=new T.PlaneGeometry(1,1);
  const material=new T.MeshBasicMaterial({transparent:true,opacity:0,colorWrite:false,depthWrite:false,depthTest:false,toneMapped:false});
  const stage=new T.Mesh(geometry,material);
  stage.name='TidebreakAuthoredEffects';stage.frustumCulled=false;stage.renderOrder=Number.MAX_SAFE_INTEGER;
  stage.castShadow=false;stage.receiveShadow=false;
  stage.onAfterRender=(renderer,_scene,camera)=>{
    if(disposed)return;
    if(!booted){
      booted=true;stage.visible=false;
      // Native initialization may compile shaders. Do it outside Three's render
      // stack, then restore Three's cache once; never reset the active framebuffer.
      Promise.resolve().then(()=>{
        if(disposed)return null;
        return backendFactory({renderer,document,baseUrl,signal:abort.signal,budget:player.snapshot().budget});
      }).then(backend=>{if(backend)player.attach(backend);}).catch(error=>player.fail(error));
      return;
    }
    // Native state restoration remains enabled. Rendering inside this pass keeps
    // world depth occlusion and tone mapping, rather than drawing over the UI.
    player.draw(camera);
  };
  view.scene.add(stage);
  const original={renderState:view.renderState,syncFront:view.syncFront,updateFront:view.updateFront,
    dispose:view.dispose,visualSnapshot:view.visualSnapshot};
  view.syncFront=(next)=>{front=next;return original.syncFront(next);};
  view.updateFront=(next)=>{front=next;return original.updateFront(next);};
  view.presentCombatEvents=(events,context)=>{
    if(disposed||document.hidden)return;
    if(context.state?.zone!=='frontier')return;
    player.present(events,context);
  };
  view.clearCombatEffects=()=>player.clear();
  view.renderState=(state,dt=0)=>{
    const level=original.visualSnapshot?.().focus?.level||0;
    player.frame(state,front,dt,{level,reduced:Boolean(motion?.matches),hidden:Boolean(document.hidden)});
    stage.visible=!booted||player.snapshot().active>0;
    return original.renderState(state,dt);
  };
  view.visualSnapshot=()=>({...original.visualSnapshot?.(),combatEffects:player.snapshot()});
  const lost=()=>{abort.abort();player.fail(Error('WebGL context lost; effects disabled for this view'));};
  canvas.addEventListener('webglcontextlost',lost);
  view.dispose=()=>{
    if(disposed)return;disposed=true;abort.abort();player.dispose();canvas.removeEventListener('webglcontextlost',lost);
    stage.onAfterRender=()=>{};stage.removeFromParent();geometry.dispose();material.dispose();original.dispose();
  };
  return view;
}
