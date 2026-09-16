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
