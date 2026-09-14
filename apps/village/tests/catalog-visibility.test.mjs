import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the real legacy UI timer bodies without booting their WebGL decoration.
// The renderer has already applied unlock visibility when either interval fires.
for(const file of ['mura-ux-polish-4.js','mura-ux-polish-4b.js']){
 test(`${file}: facility timer preserves furniture visibility between render frames`,()=>{
  const cards=[{dataset:{kind:'dirtbed'},hidden:false},{dataset:{kind:'bed'},hidden:true}];
  const nodes={housingModeTitle:{},housingModeText:{},build:{hidden:true}};
  const defs={storage:{building:true,capacity:0},dirtbed:{furniture:true},bed:{furniture:true,unlock:['plank','cloth']}};
  const world={object:id=>id==='store'?{kind:'storage'}:null,state:{known:[]}};
  const view={roomId:'store'},timers=[];
  class World {add(){} move(){} remove(){}}
  const context={World,defs,world,view,window:{village:{world,view}},document:{getElementById:id=>nodes[id],querySelectorAll:()=>cards},setInterval:fn=>timers.push(fn)};
  context.$=context.document.getElementById;
  const source=readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8');
  const code=file.endsWith('4b.js')?source.replace(/^import .*;\n/gm,''):source.slice(source.indexOf('function enableMayorFacilityHousing(){'),source.indexOf('\nfunction protectClanHomes(){'))+'\nenableMayorFacilityHousing();';
  vm.runInNewContext(code,context);
  assert.equal(timers.length,1);
  for(let tick=0;tick<6;tick++){
   timers[0]();
   assert.equal(nodes.build.hidden,false,'mayor can still open facility interiors');
   assert.equal(cards[0].hidden,false,'starter bed remains available');
   assert.equal(cards[1].hidden,true,'locked furniture must not reappear between render frames');
  }
  // A later renderer frame may unlock a new furnishing; timers also preserve it.
  world.state.known.push('plank','cloth');cards[1].hidden=false;
  timers[0]();assert.equal(cards[1].hidden,false);
 });
}
