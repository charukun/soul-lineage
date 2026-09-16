import * as T from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

/** Budget describes extra work, never a promise of zero GPU overhead. */
export function miniatureFocusBudget(level=0,width=1,height=1){
  const tier=clamp(Math.floor(level),0,3),scale=[.5,.375,.25,0][tier];
  return{enabled:tier<3&&width*height<=2400000,scale,taps:tier===0?9:5,width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale)),strength:[1,.8,.55,0][tier]};
}

export function miniatureFocusBand({focusY=.5,inside=false,combat=false}={}){
  return{center:clamp(focusY,.25,.75),clear:combat?.31:inside?.27:.20,fade:combat?.18:.19,strength:combat?.42:inside?.6:1};
}

/** One HDR scene pass, one bounded low-res blur, one composite/output pass. */
export function createMiniatureFocus(renderer){
  const supported=renderer.extensions.has('EXT_color_buffer_float');
  const source=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:Math.min(2,renderer.capabilities.maxSamples),resolveDepthBuffer:false,storeMultisampledColorBuffer:false,storeMultisampledDepthBuffer:false});
  const blurred=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
  const blur=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{image:{value:source.texture},stepSize:{value:new T.Vector2()},taps:{value:9}},vertexShader,fragmentShader:`
    varying vec2 vUv;uniform sampler2D image;uniform vec2 stepSize;uniform int taps;
    void main(){
      vec3 c=texture2D(image,vUv).rgb*4.;float weight=4.;
      c+=texture2D(image,vUv+vec2(stepSize.x,0.)).rgb*2.;
      c+=texture2D(image,vUv-vec2(stepSize.x,0.)).rgb*2.;
      c+=texture2D(image,vUv+vec2(0.,stepSize.y)).rgb*2.;
      c+=texture2D(image,vUv-vec2(0.,stepSize.y)).rgb*2.;weight+=8.;
      if(taps>5){c+=texture2D(image,vUv+stepSize).rgb;c+=texture2D(image,vUv-stepSize).rgb;
        c+=texture2D(image,vUv+vec2(stepSize.x,-stepSize.y)).rgb;c+=texture2D(image,vUv+vec2(-stepSize.x,stepSize.y)).rgb;weight+=4.;}
      gl_FragColor=vec4(c/weight,1.);
    }`});
  const composite=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{sharp:{value:source.texture},soft:{value:blurred.texture},focus:{value:.5},clearBand:{value:.2},fade:{value:.19},strength:{value:1}},vertexShader,fragmentShader:`
    varying vec2 vUv;uniform sampler2D sharp;uniform sampler2D soft;uniform float focus,clearBand,fade,strength;
    void main(){
      float amount=smoothstep(clearBand,clearBand+fade,abs(vUv.y-focus))*strength;
      if(vUv.y<focus)amount*=.6;
      gl_FragColor=vec4(mix(texture2D(sharp,vUv).rgb,texture2D(soft,vUv).rgb,amount),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const quad=new FullScreenQuad(blur),size=new T.Vector2();let level=0,budget=miniatureFocusBudget(),band=miniatureFocusBand(),disposed=false;
  function resize(){
    renderer.getDrawingBufferSize(size);budget=miniatureFocusBudget(level,size.x,size.y);
    source.setSize(size.x,size.y);blurred.setSize(budget.width,budget.height);
    // Radius is in logical pixels, independent of DPR and render quality.
    const radius=4.5*renderer.getPixelRatio();blur.uniforms.stepSize.value.set(radius/size.x,radius/size.y);blur.uniforms.taps.value=budget.taps;
  }
  function setLevel(next){if(level===next)return;level=next;resize();}
  function render(scene,camera,focusOptions){
    if(disposed)throw Error('Miniature focus has been disposed');
    const target=renderer.getRenderTarget(),autoReset=renderer.info.autoReset;
    renderer.info.autoReset=false;renderer.info.reset();
    try{
      if(!supported||!budget.enabled){renderer.render(scene,camera);return;}
      band=miniatureFocusBand(focusOptions);const u=composite.uniforms;
      u.focus.value=band.center;u.clearBand.value=band.clear;u.fade.value=band.fade;u.strength.value=band.strength*budget.strength;
      renderer.setRenderTarget(source);renderer.render(scene,camera);
      renderer.setRenderTarget(blurred);quad.material=blur;quad.render(renderer);
      renderer.setRenderTarget(target);quad.material=composite;quad.render(renderer);
    }finally{renderer.setRenderTarget(target);renderer.info.autoReset=autoReset;}
  }
  function snapshot(){return{supported,enabled:supported&&budget.enabled,level,sceneSize:[source.width,source.height],blurSize:[blurred.width,blurred.height],blurTaps:budget.taps,extraPasses:supported&&budget.enabled?2:0,focus:{...band},drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}
  function dispose(){if(disposed)return;disposed=true;source.dispose();blurred.dispose();blur.dispose();composite.dispose();quad.dispose();}
  resize();return{resize,setLevel,render,snapshot,dispose};
}
