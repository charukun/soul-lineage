import test from 'node:test';
import assert from 'node:assert/strict';
import {createActorStatus} from '../src/rebuild/actor-status.js';

class Vector3{
  set(){return this;}
  project(){this.x=0;this.y=.5;this.z=0;return this;}
}

function harness(){
  const children=[];
  const makeNode=tag=>({tag,className:'',textContent:'',style:{},hidden:false,children:[],append(child){this.children.push(child);},remove(){this.removed=true;}});
  const layer={append(node){children.push(node);}};
  const document={getElementById:id=>id==='actor-status-layer'?layer:null,createElement:makeNode};
  const actor={updateWorldMatrix(){},localToWorld(vector){return vector;}};
  const view={THREE:{Vector3},scene:{getObjectByName:name=>name==='Player'?actor:null},camera:{}};
  return{children,document,view,canvas:{clientWidth:100,clientHeight:200}};
}

test('floating actor status follows the projected actor head and can be reused for arbitrary state copy',()=>{
  const h=harness(),status=createActorStatus(h),item=status.show('抱っこされている…',{duration:60_000});
  assert.ok(item);assert.equal(h.children.length,1);assert.equal(h.children[0].children[0].textContent,'抱っこされている…');
  assert.equal(h.children[0].style.left,'50px');assert.equal(h.children[0].style.top,'50px');
  status.show('疲れている…',{duration:60_000});assert.equal(h.children.length,2);
  status.clear();assert.equal(h.children.every(node=>node.removed),true);
});

test('status reuses the actor and viewport until replacement or resize without layout reads',()=>{
  const h=harness();let lookups=0;
  const makeActor=()=>({name:'Player',parent:h.view.scene,localToWorld:v=>v});let current=makeActor();
  h.view.scene.getObjectByName=()=>{lookups++;return current;};h.view.viewport={width:100,height:200};
  Object.defineProperty(h.canvas,'clientWidth',{get(){throw Error('forced layout read');}});Object.defineProperty(h.canvas,'clientHeight',{get(){throw Error('forced layout read');}});
  const status=createActorStatus(h);status.show('移動中',{duration:60000});
  for(let i=0;i<120;i++)status.sync();assert.equal(lookups,1);
  h.view.viewport.width=200;status.sync();assert.equal(h.children[0].style.left,'100px');assert.equal(lookups,1);
  current.parent=null;current=makeActor();status.sync();assert.equal(lookups,2);status.dispose();
});
