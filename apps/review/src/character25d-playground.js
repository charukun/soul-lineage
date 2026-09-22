// Review-only input and fixtures. Actor physics/rig/motion remain shared runtime.
export function createCharacter25DPlayground({THREE,scene,camera,canvas,getActor}) {
  const ground={height:0,normal:{x:0,y:1,z:0},valid:true},intent={x:0,z:0},velocity={x:0,z:0},keys=new Set(),abort=new AbortController();
  const resources=[],objects=[];let active=false,runTouch=false,touchX=0,touchY=0,disposed=false;
  const equipment={weapon:'sword',shield:true};
  function sampleGround(x,z,out=ground) {const slope=x>=2&&x<=4&&z>=-2&&z<=0;out.height=slope?(x-2)*.12:0;out.normal.x=slope?-.119145:0;out.normal.y=slope?.992877:1;out.normal.z=0;out.valid=Math.abs(x)<5.6&&Math.abs(z)<5.6;return out;}
  const obstacles=[{x:-1.5,z:1.7,r:.48},{x:0,z:-1.8,r:.28}];
  const canMoveTo=(x,z,r)=>Math.abs(x)<5.4-r&&Math.abs(z)<5.4-r&&obstacles.every(o=>Math.hypot(x-o.x,z-o.z)>r+o.r);
  function fixture(geometry,material,x,y,z){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);objects.push(mesh);resources.push(geometry,material);return mesh;}
  fixture(new THREE.BoxGeometry(.8,.8,.8),new THREE.MeshStandardMaterial({color:0x817560,roughness:1}),-1.5,.4,1.7);
  const dummy=fixture(new THREE.CapsuleGeometry(.22,.6,4,8),new THREE.MeshStandardMaterial({color:0xb99466,roughness:1}),0,.52,-1.8);dummy.name='Character25DInteractable';
  const slopeGeo=new THREE.BufferGeometry();slopeGeo.setAttribute('position',new THREE.Float32BufferAttribute([2,0,-2,2,0,0,4,.24,-2,4,.24,-2,2,0,0,4,.24,0],3));slopeGeo.computeVertexNormals();fixture(slopeGeo,new THREE.MeshStandardMaterial({color:0x69785e,side:THREE.DoubleSide,roughness:1}),0,0,0);
  const host=document.createElement('div');host.className='character25d-playground-controls';host.innerHTML=`
    <p>WASDで移動 · Shiftで走る · ドラッグでカメラ · Spaceで攻撃 · Eで話す／拾う</p>
    <div class="character25d-options" style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px" aria-label="既存RINNE装備"><button data-weapon="sword" aria-pressed="true">剣</button><button data-weapon="axe" aria-pressed="false">斧</button><button data-weapon="spear" aria-pressed="false">槍</button><button data-weapon="great" aria-pressed="false">両手剣</button><button data-weapon="staff" aria-pressed="false">杖</button></div>
    <label><input data-shield type="checkbox" checked> 盾（両手武器中は収納）</label>
    <div class="character25d-transport"><label>動作を試す<select data-motion><option value="idle">Idle</option><option value="walk">Walk</option><option value="run">Run</option><option value="turn">Turn</option><option value="attack">Attack</option><option value="hit">Hit</option><option value="talk">Talk</option><option value="pickup">PickUp</option><option value="rest">Rest</option></select></label><button data-play-motion type="button">再生</button><button data-resume type="button">操作へ戻る</button><button data-home type="button">中央へ</button></div>
    <div class="character25d-touch"><div data-stick role="application" aria-label="移動スティック"><span></span></div><button data-run type="button">走る</button><button data-attack type="button">攻撃</button><button data-interact type="button">話す／拾う</button></div>
    <output data-actor-status role="status">画像を入れるとここで動かせます</output>`;
  canvas.closest('.hybrid25d-stage').after(host);canvas.tabIndex=0;canvas.setAttribute('aria-label','Character25D Playground');
  const listen=(target,event,fn)=>target.addEventListener(event,fn,{signal:abort.signal});
  for(const button of host.querySelectorAll('[data-weapon]'))listen(button,'click',()=>{equipment.weapon=button.dataset.weapon;getActor()?.setEquipment?.(equipment);for(const b of host.querySelectorAll('[data-weapon]'))b.setAttribute('aria-pressed',String(b===button));});
  listen(host.querySelector('[data-shield]'),'change',event=>{equipment.shield=event.target.checked;getActor()?.setEquipment?.(equipment);});
  const useAction=name=>{const actor=getActor();if(actor?.play){actor.play(name);if(name==='turn')actor.setFacing(actor.proxy.yaw+Math.PI/2);}};
  function interact(){const actor=getActor();if(!actor?.proxy)return;const d=Math.hypot(actor.proxy.position.x,actor.proxy.position.z+1.8);useAction(d<1.65?'talk':'pickup');dummy.material.emissive?.setHex(d<1.65?0x443311:0);}
  listen(canvas,'pointerdown',()=>{active=true;canvas.focus({preventScroll:true});});
  listen(window,'keydown',event=>{if(!active||/INPUT|SELECT|TEXTAREA/.test(event.target?.tagName))return;if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','Space','KeyE','KeyH','KeyQ','KeyR','KeyT'].includes(event.code)){event.preventDefault();keys.add(event.code);if(!event.repeat){if(event.code==='Space')useAction('attack');if(event.code==='KeyH')useAction('hit');if(event.code==='KeyQ')useAction('talk');if(event.code==='KeyR')useAction('rest');if(event.code==='KeyT')useAction('turn');if(event.code==='KeyE')interact();}}});
  listen(window,'keyup',event=>keys.delete(event.code));
  const clear=()=>{keys.clear();touchX=touchY=0;runTouch=false;velocity.x=velocity.z=0;getActor()?.setVelocity?.(velocity);};
  listen(window,'blur',()=>{active=false;clear();});listen(document,'visibilitychange',()=>{if(document.hidden)clear();});
  listen(host.querySelector('[data-play-motion]'),'click',()=>useAction(host.querySelector('[data-motion]').value));
  listen(host.querySelector('[data-resume]'),'click',()=>{getActor()?.releaseAction?.();active=true;canvas.focus({preventScroll:true});});
  listen(host.querySelector('[data-home]'),'click',()=>{clear();getActor()?.setTransform?.({x:1.2,y:0,z:0},0);getActor()?.releaseAction?.();});
  listen(host.querySelector('[data-attack]'),'click',()=>useAction('attack'));listen(host.querySelector('[data-interact]'),'click',interact);
  const run=host.querySelector('[data-run]');listen(run,'pointerdown',event=>{run.setPointerCapture(event.pointerId);runTouch=true;});for(const name of ['pointerup','pointercancel','lostpointercapture'])listen(run,name,()=>{runTouch=false;});
  const stick=host.querySelector('[data-stick]'),knob=stick.firstElementChild;let pointer=null;
  function drag(event){if(event.pointerId!==pointer)return;const box=stick.getBoundingClientRect(),x=(event.clientX-box.x-box.width/2)/(box.width*.35),y=(event.clientY-box.y-box.height/2)/(box.height*.35),length=Math.max(1,Math.hypot(x,y));touchX=x/length;touchY=-y/length;knob.style.transform=`translate(${touchX*27}px,${-touchY*27}px)`;}
  listen(stick,'pointerdown',event=>{pointer=event.pointerId;stick.setPointerCapture(pointer);active=true;getActor()?.releaseAction?.();drag(event);});listen(stick,'pointermove',drag);for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(stick,type,()=>{pointer=null;touchX=touchY=0;knob.style.transform='';});
  const timer=setInterval(()=>{const actor=getActor();host.querySelector('[data-actor-status]').textContent=actor?.getStatus?.()||'画像を入れるとここで動かせます';},300);
  return {sampleGround,canMoveTo,
    activate(){active=true;getActor()?.setEquipment?.(equipment);canvas.focus({preventScroll:true});},
    update(dt){const actor=getActor();if(!actor?.proxy)return;let x=touchX+Number(keys.has('KeyD'))-Number(keys.has('KeyA')),z=touchY+Number(keys.has('KeyW'))-Number(keys.has('KeyS'));const length=Math.max(1,Math.hypot(x,z));x/=length;z/=length;
      const dx=camera.position.x-actor.proxy.position.x,dz=camera.position.z-actor.proxy.position.z,d=Math.hypot(dx,dz)||1,speed=runTouch||keys.has('ShiftLeft')||keys.has('ShiftRight')?4.1:2.1;
      intent.x=(x*dz-z*dx)/d*speed;intent.z=(-x*dx-z*dz)/d*speed;const blend=1-Math.exp(-dt*18);velocity.x+=(intent.x-velocity.x)*blend;velocity.z+=(intent.z-velocity.z)*blend;if(Math.hypot(velocity.x,velocity.z)<.015)velocity.x=velocity.z=0;actor.setVelocity(velocity);
      if(Math.hypot(x,z)>.1)actor.releaseAction({locomotionOnly:true});
    },
    dispose(){if(disposed)return;disposed=true;clearInterval(timer);abort.abort();host.remove();for(const object of objects)object.removeFromParent();for(const resource of resources)resource.dispose();}
  };
}
