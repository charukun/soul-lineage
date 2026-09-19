import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { seededRandom } from '../domain/rules.js';
export class World {
  constructor(canvas,assets,settings) {
    this.canvas=canvas;this.settings=settings;this.assets=assets;this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color('#101f24');this.scene.fog=new THREE.FogExp2('#11282b',.022);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    const gl=this.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
    this.software=debug?/swiftshader|llvmpipe|software/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)):false;
    this.renderer.info.autoReset=false;this.lastRender=0;this.renderCount=0;
    this.renderer.setClearColor('#101f24');this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.camera=new THREE.OrthographicCamera(-20,20,12,-12,.1,120);this.camera.position.set(13,25,22);this.focus=new THREE.Vector3(0,0,0);this.camera.lookAt(this.focus);
    this.scene.add(new THREE.HemisphereLight('#aac4d0','#314345',2.5));
    const sun=new THREE.DirectionalLight('#ffe0ac',4.1);sun.position.set(-13,22,-8);sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=24;sun.shadow.camera.bottom=-24;sun.shadow.camera.far=65;sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;
    this.scene.add(sun);this.sun=sun;
    const rim=new THREE.DirectionalLight('#4b9aad',2.1);rim.position.set(8,7,15);this.scene.add(rim);
    this.heroLight=new THREE.PointLight('#ffe3ae',11,8,2);this.heroLight.position.set(0,3,0);this.scene.add(this.heroLight);
    this.flashLight=new THREE.PointLight('#ffc875',0,15,2);this.scene.add(this.flashLight);
    this.lamps=[];this.firePositions=[];this.shake=0;this.shakeTime=0;this.elapsed=0;this.mode='title';
    this.buildEnvironment();
    this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(800,600),.38,.42,1.05);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
    this.resize();
  }
  buildEnvironment(){
    const batches=new Map(),rng=seededRandom(492),tmp=new THREE.Object3D();
    const add=(id,x,z,ry=0,scale=1,y=0)=>{if(!batches.has(id))batches.set(id,[]);tmp.position.set(x,y,z);tmp.rotation.set(0,ry,0);tmp.scale.setScalar(scale);tmp.updateMatrix();batches.get(id).push(tmp.matrix.clone());};
    for(let x=-5;x<=5;x++)for(let z=-5;z<=4;z++) {
      const outside=Math.abs(x)>3||Math.abs(z)>3;
      add(outside?'floor_dirt_large_rocky':'floor_tile_large',x*4,z*4,Math.floor(rng()*4)*Math.PI/2,1,-.13);
      if(!outside&&rng()<.28)add('floor_tile_small_weeds_A',x*4+(rng()-.5)*2,z*4+(rng()-.5)*2,rng()*6.28,.95,-.08);
    }
    for(const [x,z]of [[-5,-7],[4,-5],[-7,4],[6,7],[1,4]])add('floor_tile_small_broken_A',x,z,rng()*6.28,1,-.09);
    for(const [x,z]of [[-7,-11],[7,-11]])add('floor_tile_small_decorated',x,z,0,1,-.08);
    for(let x=-4;x<=4;x++)add(x===0?'wall_arched':Math.abs(x)%2?'wall_archedwindow_open':'wall_broken',x*4,-15,0,1);
    for(let z=-3;z<=2;z++){add(z%2?'wall_broken':'wall_half',-16,z*4,Math.PI/2,1);add(z%2?'wall_half':'wall_broken',16,z*4,-Math.PI/2,1);}
    for(const x of [-12,-6,6,12]) {
      add('pillar_decorated',x,-11.5,0,1);
      if(Math.abs(x)>8){add('pillar',x,6.8,0,.95);add('banner_patternA_red',x,6.8,Math.PI,.9);}
      else add('banner_triple_red',x,-12,0,.9);
      add('candle_triple',x+(x<0?1.2:-1.2),-10.5,0,1);
    }
    add('wall_arched',0,-13.8,0,1.2);add('stairs',0,-18,0,1);
    add('chest_gold',-9,-9,.3,1.3);add('sword_shield_gold',-9.5,-7.3,-.4,1);
    for(let i=0;i<34;i++){
      const side=i%2===0?-1:1;let x=side*(13.5+rng()*5),z=-14+rng()*27;
      if(i<10){x=-12+rng()*24;z=-13+rng()*1.5;}
      add(i%4?'rubble_large':'rubble_half',x,z,rng()*6.28,.5+rng()*.85);
    }
    for(const [x,z]of [[-11,8.5],[12,-8],[-13,-8],[14,9]]){add('barrel_large',x,z,rng()*6,1);add('crates_stacked',x+.8,z+.6,rng()*6,.8);}
    for(const [x,z]of [[-10,-8],[10,-8],[-11,4],[11,4],[0,-13]]){
      add('torch_lit',x,z,0,1.5,.6);this.firePositions.push({x,y:1.8,z});
      if(x===-10||x===11){const light=new THREE.PointLight('#ffb65f',22,9,2);light.position.set(x,1.8,z);this.scene.add(light);this.lamps.push(light);}
    }
    for(const [id,matrices]of batches){
      const source=this.assets.model(id).scene;source.updateMatrixWorld(true);
      source.traverse(o=>{
        if(!o.isMesh)return;
        const material=o.material.clone();material.roughness=.91;material.metalness=.06;
        if(!/torch|candle|gold|banner/.test(id))material.color.multiply(new THREE.Color('#698c91'));
        if(/banner/.test(id))material.color.multiply(new THREE.Color('#ab7b78'));
        const instanced=new THREE.InstancedMesh(o.geometry,material,matrices.length);
        for(let i=0;i<matrices.length;i++)instanced.setMatrixAt(i,matrices[i].clone().multiply(o.matrixWorld));
        instanced.castShadow=!/floor/.test(id);instanced.receiveShadow=true;instanced.computeBoundingSphere();instanced.name=`original:${id}`;this.scene.add(instanced);
      });
    }
  }
  setQuality(value){this.settings.quality=value;this.resize();}
  resize(){
    const w=innerWidth,h=innerHeight;this.mobile=w<700||matchMedia('(pointer:coarse)').matches;
    this.low=this.settings.quality==='low'||(this.settings.quality==='auto'&&(this.mobile||this.software));
    const dpr=Math.min(devicePixelRatio||1,this.software?.75:this.low?1.15:1.5);
    this.renderer.setPixelRatio(dpr);this.renderer.setSize(w,h,false);this.composer.setPixelRatio(dpr);this.composer.setSize(w,h);
    const viewH=w/h<.8?28:w/h<1.2?27:23;
    this.camera.left=-viewH*w/h/2;this.camera.right=viewH*w/h/2;this.camera.top=viewH/2;this.camera.bottom=-viewH/2;this.camera.updateProjectionMatrix();
    this.sun.shadow.mapSize.set(this.software?512:this.low?1024:2048,this.software?512:this.low?1024:2048);
    if(this.sun.shadow.map){this.sun.shadow.map.dispose();this.sun.shadow.map=null;}
    this.bloom.enabled=!this.low;
  }
  impact(pos,power=1,color='#ffd289') {this.flashLight.position.copy(pos);this.flashLight.position.y=2;this.flashLight.color.set(color);this.flashLight.intensity=Math.max(this.flashLight.intensity,35*power);if(this.settings.shake){this.shake=Math.max(this.shake,power*.17);this.shakeTime=.23;}}
  update(dt,hero){
    this.elapsed+=dt;
    const title=this.mode==='title',follow=hero?.position||new THREE.Vector3(),weight=this.mobile?.9:.16;
    const desired=new THREE.Vector3(follow.x*weight,0,follow.z*weight+(this.mobile?1.5:0));
    if(title&&!this.mobile)desired.x=-4.3;
    this.focus.lerp(desired,1-Math.exp(-dt*3));
    const sway=title?Math.sin(this.elapsed*.11)*1.3:0;
    this.camera.position.set(this.focus.x+13+sway,this.focus.y+25,this.focus.z+22);
    if(this.shakeTime>0){this.shakeTime-=dt;this.camera.position.x+=(Math.random()-.5)*this.shake;this.camera.position.y+=(Math.random()-.5)*this.shake;this.shake*=Math.exp(-dt*9);}
    this.camera.lookAt(this.focus);this.camera.updateMatrixWorld();
    if(hero){this.heroLight.position.copy(hero.position);this.heroLight.position.y=3.3;}
    this.flashLight.intensity*=Math.exp(-dt*12);
    for(let i=0;i<this.lamps.length;i++)this.lamps[i].intensity=19+Math.sin(this.elapsed*5+i*7)*2+Math.sin(this.elapsed*8.1+i)*1.3;
  }
  render(){const now=performance.now();if(this.software&&now-this.lastRender<100)return;this.lastRender=now;this.renderCount++;this.renderer.info.reset();if(this.low)this.renderer.render(this.scene,this.camera);else this.composer.render();}
}
