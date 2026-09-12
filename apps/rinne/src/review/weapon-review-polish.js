import { THREE, GLTFLoader } from '@soul/rendering';
const KAYKIT_COMMIT='672074b73ba276876a19e8816ecdc5241817ab47';
const ROOT=`https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/${KAYKIT_COMMIT}/addons/kaykit_character_pack_adventures/Assets/gltf/`;
const SPECS={
 greatsword:{file:'sword_2handed.gltf',scale:.50,pos:[.005,-.015,.005],rot:[0,0,-90]},
 sword:{file:'sword_1handed.gltf',scale:.50,pos:[.005,-.012,.004],rot:[0,0,-90]},
 katana:{factory:createKatana,scale:1,pos:[.004,-.012,.003],rot:[0,0,0]},
 axe:{file:'axe_1handed.gltf',scale:.50,pos:[.004,-.012,.004],rot:[0,0,-90]},
 greataxe:{file:'axe_2handed.gltf',scale:.50,pos:[.005,-.018,.004],rot:[0,0,-90]},
 dagger:{file:'dagger.gltf',scale:.50,pos:[.004,-.010,.003],rot:[0,0,-90]},
 crossbow:{file:'crossbow_2handed.gltf',scale:.50,pos:[.012,-.025,-.005],rot:[-90,0,-90]},
 staff:{file:'staff.gltf',scale:.50,pos:[.004,-.02,.003],rot:[0,0,-90]},
 wand:{file:'wand.gltf',scale:.50,pos:[.004,-.010,.003],rot:[0,0,-90]}
};
const rad=n=>n*Math.PI/180;
function mat(color,metalness=.15,roughness=.55){return new THREE.MeshStandardMaterial({color,metalness,roughness});}
function createKatana(){
 const root=new THREE.Group();root.name='ReviewKatana';
 const steel=mat(0xdce5e7,.78,.22),edge=mat(0xf7fbfb,.9,.16),dark=mat(0x17191b,.15,.78),guard=mat(0x6d5331,.65,.38),wrap=mat(0x40352e,.05,.9);
 const handle=new THREE.Mesh(new THREE.CylinderGeometry(.032,.034,.29,12),dark);handle.position.y=-.105;root.add(handle);
 for(let i=0;i<6;i++){const band=new THREE.Mesh(new THREE.TorusGeometry(.0345,.005,6,12),wrap);band.rotation.x=Math.PI/2;band.position.y=-.225+i*.047;root.add(band);}
 const tsuba=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.014,24),guard);tsuba.rotation.x=Math.PI/2;tsuba.position.y=.05;root.add(tsuba);
 const bladeShape=new THREE.Shape();bladeShape.moveTo(-.026,.055);bladeShape.quadraticCurveTo(-.010,.62,.018,1.08);bladeShape.quadraticCurveTo(.024,1.20,0,1.28);bladeShape.quadraticCurveTo(.050,1.15,.060,1.05);bladeShape.quadraticCurveTo(.035,.55,.026,.055);bladeShape.closePath();
 const blade=new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape,{depth:.014,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:1}),steel);blade.position.z=-.007;root.add(blade);
 const ha=new THREE.Mesh(new THREE.BoxGeometry(.009,1.13,.020),edge);ha.position.set(.032,.65,0);ha.rotation.z=-.018;root.add(ha);
 root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return root;
}
function ensureReviewControls(){
 const select=document.querySelector('#weapon-select');if(select&&!select.querySelector('option[value="katana"]'))select.add(new Option('刀','katana'),2);
 for(const id of ['weapon-x','weapon-y','weapon-z']){const node=document.getElementById(id);if(node&&!node.dataset.gripPolish){node.value='0';node.dataset.gripPolish='1';}}
 const head=document.querySelector('.notebook-head');if(head&&!document.querySelector('.combat-mode-switch')){const wrap=document.createElement('div');wrap.className='combat-mode-switch';wrap.innerHTML='<span>姿勢</span><button type="button" data-combat-mode="normal" class="active">通常</button><button type="button" data-combat-mode="combat">戦闘態勢</button>';head.append(wrap);wrap.addEventListener('click',e=>{const b=e.target.closest('[data-combat-mode]');if(!b)return;wrap.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));document.dispatchEvent(new CustomEvent('review-combat-mode',{detail:{mode:b.dataset.combatMode}}));});}
 if(!document.getElementById('weapon-grip-polish-style')){const style=document.createElement('style');style.id='weapon-grip-polish-style';style.textContent='.combat-mode-switch{display:flex;align-items:center;gap:4px;margin-left:auto}.combat-mode-switch span{font-size:8px;color:#90a697}.combat-mode-switch button{min-height:28px;border:1px solid #b4bda238;border-radius:999px;background:#12282980;color:#91a99d;padding:0 9px;font-size:8px}.combat-mode-switch button.active{border-color:var(--gold);color:#f0dfb3;background:#d6bd8418}';document.head.append(style);}
}
export function installWeaponReviewPolish(body){
 ensureReviewControls();
 if(!body?.bones?.rightHand)return body;
 body.bones.rightHand.getObjectByName('ReviewWeaponSocket')?.removeFromParent();
 const socket=new THREE.Group();socket.name='ReviewWeaponPolishedSocket';body.bones.rightHand.add(socket);
 const roots=new Map(),pending=new Map(),loader=new GLTFLoader();let active=null;
 async function get(id){
   const spec=SPECS[id]||SPECS.greatsword;id=SPECS[id]?id:'greatsword';
   if(roots.has(id))return roots.get(id);
   if(!pending.has(id))pending.set(id,(async()=>{const root=spec.factory?spec.factory():(await loader.loadAsync(ROOT+spec.file)).scene;root.name=`ReviewWeapon:${id}`;root.visible=false;socket.add(root);roots.set(id,root);pending.delete(id);return root;})());
   return pending.get(id);
 }
 body.setWeapon=async({enabled=false,id=null,scale=.5,x=0,y=0,z=0}={})=>{
   if(!enabled){socket.visible=false;return;}
   const requested=SPECS[id]?id:(document.querySelector('#weapon-select')?.value||'greatsword');active=requested;
   const root=await get(requested);for(const [key,node] of roots)node.visible=key===requested;socket.visible=true;
   const spec=SPECS[requested]||SPECS.greatsword,ui=Math.max(.1,Math.min(1,scale));root.scale.setScalar(spec.scale*(ui/.5));
   socket.position.set(...spec.pos);socket.rotation.set(rad(spec.rot[0]+x),rad(spec.rot[1]+y),rad(spec.rot[2]+z));
 };
 const oldDispose=body.dispose?.bind(body);body.dispose=()=>{for(const root of roots.values())root.removeFromParent();socket.removeFromParent();oldDispose?.();};
 return body;
}
export const reviewWeaponIds=Object.freeze(Object.keys(SPECS));
