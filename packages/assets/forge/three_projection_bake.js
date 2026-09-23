/** GPU execution of pinned bake_projected_texture.py's descriptor-only contract.
 * This adapter supplies camera/UV transport and pixel baking, never a mesher.
 * Run before mesh-freeze: UV charts duplicate vertices without changing shape.
 */
import {applyReferenceCamera} from './reference_camera.js';
export async function bakeReferenceProjection(THREE,renderer,model,cameraFits,mapSources,{textureSize=1024}={}) {
  const names=['front','side','back'],channels=['albedo','roughness','normal','height','ao'];
  if(!names.every(v=>cameraFits[v]&&mapSources[v]))throw Error('Admitted front/side/back projection evidence is required');
  const views=[],loader=new THREE.TextureLoader(),savedTarget=renderer.getRenderTarget(),savedColor=renderer.getClearColor(new THREE.Color()),savedAlpha=renderer.getClearAlpha();
  model.rotation.y=0;model.updateMatrixWorld(true);
  const subject=new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
  for(const [name,angle] of [['front',0],['side',-Math.PI/2],['back',Math.PI]]){
    const source=mapSources[name],maps={};
    for(const channel of [...channels,'mask']){maps[channel]=await loader.loadAsync(channel==='mask'?source.foregroundMask:source.maps[channel]);maps[channel].colorSpace=THREE.NoColorSpace;}
    const camera=applyReferenceCamera(THREE,new THREE.PerspectiveCamera(20,.5,.01,100),cameraFits[name]);
    const distance=camera.position.distanceTo(subject.center);
    camera.near=Math.max(.01,distance-subject.radius*1.5);camera.far=distance+subject.radius*1.5;camera.updateProjectionMatrix();
    const rotation=new THREE.Matrix4().makeRotationY(angle),matrix=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(rotation);
    const scene=new THREE.Scene(),proxy=new THREE.Group();proxy.rotation.y=angle;scene.add(proxy);
    // Object3D.clone serializes userData, whose sculptRuntime contains live scene
    // references. Build a geometry-only depth proxy without copying that graph.
    model.traverse(n=>{if(n.isMesh&&n.visible&&n.material.opacity!==0){const part=new THREE.Mesh(n.geometry);part.matrixAutoUpdate=false;part.matrix.copy(n.matrixWorld);proxy.add(part);}});
    const target=new THREE.WebGLRenderTarget(540,1080);target.depthTexture=new THREE.DepthTexture(540,1080,THREE.UnsignedIntType);
    scene.overrideMaterial=new THREE.MeshBasicMaterial({color:0xffffff});
    renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);scene.overrideMaterial.dispose();
    const [w,h]=source.imageSize,b=source.pbrCrop;
    // Upstream normal/roughness/height/AO are cropped; albedo and mask are full-view.
    const crop=new THREE.Vector4(b.x/w,1-(b.y+b.height)/h,b.width/w,b.height/h);
    views.push({name,maps,matrix,target,crop});
  }
  const vertexShader=`attribute vec4 tangent;varying vec3 worldPoint;varying vec3 worldNormal;varying vec3 worldTangent;varying float tangentSign;
    void main(){worldPoint=(modelMatrix*vec4(position,1.)).xyz;worldNormal=normalize(normalMatrix*normal);worldTangent=normalize(mat3(modelMatrix)*tangent.xyz);tangentSign=tangent.w;gl_Position=vec4(uv*2.-1.,0.,1.);}`;
  const fragmentShader=`precision highp float;
    varying vec3 worldPoint;varying vec3 worldNormal;varying vec3 worldTangent;varying float tangentSign;
    uniform sampler2D frontImage,sideImage,backImage,frontDepth,sideDepth,backDepth,frontMask,sideMask,backMask;
    uniform mat4 frontMatrix,sideMatrix,backMatrix;uniform vec4 frontCrop,sideCrop,backCrop;
    uniform vec3 fallbackColor;uniform int channelIndex;
    vec4 sampleView(sampler2D tex,sampler2D depthTex,sampler2D maskTex,mat4 camera,vec4 crop,vec3 p,float facing,vec3 right,vec3 normal){
      if(facing<=.001)return vec4(0.);
      vec4 clip=camera*vec4(p,1.);vec3 ndc=clip.xyz/clip.w;vec2 st=ndc.xy*.5+.5;
      if(min(st.x,st.y)<0.||max(st.x,st.y)>1.)return vec4(0.);
      float visible=1.-step(texture2D(depthTex,st).r+.00025,ndc.z*.5+.5);
      float weight=pow(max(facing,0.),5.)*texture2D(maskTex,st).r*visible;
      if(weight<=.00001)return vec4(0.);
      vec2 uv=channelIndex==0?st:(st-crop.xy)/crop.zw;
      vec3 color=texture2D(tex,clamp(uv,0.,1.)).rgb;
      if(channelIndex==2){
        vec3 mapped=color*2.-1.,tx=normalize(right-normal*dot(right,normal)),ty=normalize(cross(normal,tx));
        color=normalize(tx*mapped.x+ty*mapped.y+normal*mapped.z);
      }
      return vec4(color*weight,weight);
    }
    void main(){vec3 n=normalize(worldNormal),p=worldPoint;
      vec4 f=sampleView(frontImage,frontDepth,frontMask,frontMatrix,frontCrop,p,n.z,vec3(1.,0.,0.),n);
      vec4 b=sampleView(backImage,backDepth,backMask,backMatrix,backCrop,p,-n.z,vec3(-1.,0.,0.),n);
      vec3 mirrored=p;mirrored.x=abs(p.x);
      vec3 sideNormal=n;sideNormal.x=abs(n.x);
      vec4 s=sampleView(sideImage,sideDepth,sideMask,sideMatrix,sideCrop,mirrored,abs(n.x),vec3(0.,0.,-1.),sideNormal);
      if(channelIndex==2&&p.x<0.)s.x=-s.x;
      vec4 sum=f+b+s;bool covered=sum.a>.0001;
      vec3 rgb=covered?sum.rgb/sum.a:fallbackColor;
      if(channelIndex==2){
        vec3 normal=covered?normalize(rgb):n;
        vec3 t=normalize(worldTangent-n*dot(n,worldTangent)),bitangent=normalize(cross(n,t))*tangentSign;
        rgb=vec3(dot(normal,t),dot(normal,bitangent),dot(normal,n))*.5+.5;
      }
      float contributing=step(.0001,f.a)+step(.0001,b.a)+step(.0001,s.a);
      float provenance=!covered?.25:((p.x<0.&&s.a>f.a+b.a)?.5:(contributing>1.?.75:1.));
      gl_FragColor=vec4(rgb,provenance);
    }`;
  const meshes=[];model.traverse(n=>{if(n.isMesh&&n.visible&&n.material.opacity!==0)meshes.push(n);});
  const outputs=[];
  try{for(const mesh of meshes){
    const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
    const parity={maxPositionDelta:0,maxNormalDelta:0};
    for(let i=0;i<geometry.attributes.position.count;i++){
      const oldIndex=mesh.geometry.index?mesh.geometry.index.getX(i):i;
      for(let axis=0;axis<3;axis++)for(const [attribute,metric]of [['position','maxPositionDelta'],['normal','maxNormalDelta']])parity[metric]=Math.max(parity[metric],Math.abs(geometry.attributes[attribute].array[i*3+axis]-mesh.geometry.attributes[attribute].array[oldIndex*3+axis]));
    }
    if(parity.maxPositionDelta!==0||parity.maxNormalDelta!==0)throw Error('Projection changed the accepted shape');
    const count=geometry.attributes.position.count,triangles=count/3,cells=Math.ceil(Math.sqrt(triangles));
    const size=Math.max(textureSize,2**Math.ceil(Math.log2(cells*9))),cell=size/cells,padding=1.5;
    if(size>4096)throw Error('Projection atlas exceeds the reviewed allocation; author UVs before baking '+mesh.name);
    if(cell<7)throw Error('Insufficient atlas resolution for '+mesh.name);
    const uv=new Float32Array(count*2);
    for(let t=0;t<triangles;t++){const x=(t%cells)*cell,y=Math.floor(t/cells)*cell;uv.set([(x+padding)/size,(y+padding)/size,(x+cell-padding)/size,(y+padding)/size,(x+padding)/size,(y+cell-padding)/size],t*6);}
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(Array.from({length:count},(_,i)=>i));geometry.computeTangents();
    const palette=mesh.material.userData.sculptMaterial?.baseColor||'#808080';
    const uniforms={fallbackColor:{value:new THREE.Color().setStyle(palette,THREE.SRGBColorSpace).convertLinearToSRGB()},channelIndex:{value:0}};
    for(const v of views){uniforms[v.name+'Image']={value:v.maps.albedo};uniforms[v.name+'Depth']={value:v.target.depthTexture};uniforms[v.name+'Mask']={value:v.maps.mask};uniforms[v.name+'Matrix']={value:v.matrix};uniforms[v.name+'Crop']={value:v.crop};}
    const material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms,side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false});
    const scene=new THREE.Scene(),bakeMesh=new THREE.Mesh(geometry,material);bakeMesh.matrixAutoUpdate=false;bakeMesh.matrix.copy(mesh.matrixWorld);
    // The shader rasterizes UVs, not world coordinates. A world-space frustum
    // test would wrongly discard head/neck meshes above the identity camera.
    bakeMesh.frustumCulled=false;scene.add(bakeMesh);
    const textures={},files={},coverage={observed:0,interpolated:0,mirrored:0,inferred:0};
    for(let channel=0;channel<channels.length;channel++){
      const name=channels[channel];uniforms.channelIndex.value=channel;
      for(const v of views)uniforms[v.name+'Image'].value=v.maps[name];
      if(channel!==0)uniforms.fallbackColor.value.setRGB(name==='roughness'?.9:name==='ao'?1:.5,name==='roughness'?.9:name==='ao'?1:.5,name==='normal'?1:name==='roughness'?.9:name==='ao'?1:.5);
      const target=new THREE.WebGLRenderTarget(size,size,{depthBuffer:false,stencilBuffer:false});
      renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,new THREE.Camera());
      const pixels=new Uint8Array(size*size*4);renderer.readRenderTargetPixels(target,0,0,size,size,pixels);target.dispose();
      if(channel===0){
        const mask=new Uint8ClampedArray(pixels.length);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const src=(y*size+x)*4,dst=((size-1-y)*size+x)*4,a=pixels[src+3];mask.set([a,a,a,a?255:0],dst);}
        const canvas=document.createElement('canvas');canvas.width=canvas.height=size;canvas.getContext('2d').putImageData(new ImageData(mask,size,size),0,0);files.provenance=canvas.toDataURL('image/png');
      }
      for(let i=3;i<pixels.length;i+=4){const alpha=pixels[i];if(!alpha)continue;if(channel===0)coverage[alpha>224?'observed':alpha>160?'interpolated':alpha>96?'mirrored':'inferred']++;pixels[i]=255;}
      for(let pass=0;pass<2;pass++){const source=pixels.slice();for(let y=1;y<size-1;y++)for(let x=1;x<size-1;x++){const i=(y*size+x)*4;if(source[i+3])continue;for(const d of [-4,4,-size*4,size*4])if(source[i+d+3]){pixels.set(source.subarray(i+d,i+d+4),i);break;}}}
      const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const flipped=new Uint8ClampedArray(pixels.length);
      for(let y=0;y<size;y++)flipped.set(pixels.subarray(y*size*4,(y+1)*size*4),(size-1-y)*size*4);
      canvas.getContext('2d').putImageData(new ImageData(flipped,size,size),0,0);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=channel===0?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;
      textures[name]=texture;files[name]=canvas.toDataURL('image/png');
    }
    if(Object.values(coverage).reduce((sum,count)=>sum+count,0)===0)throw Error('UV bake produced no rasterized texels for '+mesh.name);
    mesh.geometry=geometry;
    mesh.material=new THREE.MeshStandardMaterial({map:textures.albedo,color:0xffffff,roughness:1,roughnessMap:textures.roughness,normalMap:textures.normal,normalScale:new THREE.Vector2(.12,.12),bumpMap:textures.height,bumpScale:.0005,aoMap:textures.ao,aoMapIntensity:.15,metalness:0});
    mesh.material.userData.projection={source:'img2threejs camera/de-light/PBR evidence',coverage,physicalChannels:'inferred upstream estimates'};
    outputs.push({mesh:mesh.name,width:size,height:size,triangles,files,coverage,geometryParity:parity,provenanceMask:{64:'inferred palette',128:'mirrored opposite side',191:'interpolated multi-view blend',255:'observed de-lit pixels'},geometryStatus:'generated by pinned upstream from observed constraints; UV charting precedes freeze',method:'calibrated camera projection + depth visibility + unique UV charts + GPU rasterization',physicalChannels:'inferred; independent pinned-extractor fields, never albedo aliases'});
    material.dispose();
  }}finally{renderer.setRenderTarget(savedTarget);renderer.setClearColor(savedColor,savedAlpha);for(const v of views){v.target.dispose();Object.values(v.maps).forEach(t=>t.dispose());}}
  return outputs;
}
