import { batchStaticMeshes } from '@soul/rendering/instance-atlas';
import { NightView } from './web/view.js';

const states=new WeakMap();
function stateFor(view){let state=states.get(view);if(!state){state={children:-1,batch:null,generation:0,snapshot:Object.freeze({generation:0,batches:0,instances:0})};states.set(view,state);}return state;}
function refresh(view,state){
  state.batch?.restore?.();
  state.batch=batchStaticMeshes(view.environment,{minInstances:3,maxInstances:256});
  state.children=view.environment?.children?.length||0;state.generation++;
  state.snapshot=Object.freeze({generation:state.generation,batches:state.batch.batches,instances:state.batch.instances});
  view.__lateStaticBatch=state.snapshot;return state.snapshot;
}

const build=NightView.prototype.build;
NightView.prototype.build=function buildWithAsyncStaticRefresh(...args){
  const state=stateFor(this);state.batch?.restore?.();state.batch=null;
  const result=build.apply(this,args);state.children=this.environment?.children?.length||0;refresh(this,state);return result;
};

const update=NightView.prototype.update;
NightView.prototype.update=function updateWithAsyncStaticRefresh(...args){
  const result=update.apply(this,args),state=stateFor(this),children=this.environment?.children?.length||0;
  if(children!==state.children)refresh(this,state);
  return result;
};

NightView.prototype.lateStaticBatchSnapshot=function lateStaticBatchSnapshot(){return stateFor(this).snapshot;};
