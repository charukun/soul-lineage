// Web-only title renderer. This does not replace or modify the Tidebreak renderer.
const VS = `#version 300 es
in vec2 position;out vec2 vUv;void main(){vUv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const FS = `#version 300 es
precision highp float;
in vec2 vUv;out vec4 fragColor;uniform sampler2D picture;uniform vec2 resolution;uniform vec2 drift;uniform float time;uniform float reveal;uniform float motion;uniform float imageAspect;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float mist(vec2 p){return noise(p)*.58+noise(p*2.07+7.)*.29+noise(p*4.13+11.)*.13;}
void main(){
 float aspect=resolution.x/resolution.y;
 vec2 fit=aspect<imageAspect?vec2(aspect/imageAspect,1.):vec2(1.,imageAspect/aspect);
 float zoom=1.025+(1.-reveal)*.14+sin(time*.065)*.009*motion;
 float depth=pow(1.-vUv.y,1.45);
 vec2 uv=(vUv-.5)*fit/zoom+vec2(mix(.60,.5,smoothstep(.6,1.5,aspect)),.505);
 uv+=drift*vec2(.008,.004)*(1.+depth*2.0)*motion;
 uv+=vec2(sin(time*.055)*.009,cos(time*.07)*.005)*motion;
 vec3 color=texture(picture,clamp(uv,vec2(.003),vec2(.997))).rgb;
 color=mix(color,color*vec3(.72,.87,1.04),.15);
 float n=mist(vUv*vec2(3.,2.7)+vec2(time*.012,-time*.004)*motion);
 float cloud=smoothstep(.46,.81,n)*(.06+.11*pow(vUv.y,2.));
 color=mix(color,vec3(.65,.76,.72),cloud*motion);
 float distanceFromLight=length((vUv-vec2(.60,.78))*vec2(aspect,.85));
 color+=vec3(.9,.57,.2)*exp(-distanceFromLight*8.)*.14*(.88+sin(time*.29)*.12*motion);
 float edge=pow(abs(vUv.x-.5)*1.55,2.)+pow(abs(vUv.y-.5)*1.12,2.);
 color*=1.-edge*.22;
 float threshold=noise(floor(vUv*vec2(49.,89.))*.63)*.37+length((vUv-vec2(.5,.65))*vec2(.8,1.))*.4;
 float opening=smoothstep(threshold-.08,threshold+.16,reveal*1.35-.08);
 vec3 ink=vec3(.024,.058,.076);
 color=mix(ink,color,opening);
 float rim=exp(-abs(reveal*1.35-.08-threshold)*55.)*(1.-smoothstep(.75,1.,reveal));
 color+=vec3(.55,.32,.075)*rim*.27;
 fragColor=vec4(color,1.);
}`;
export class TitleWorld {
  constructor(canvas, assetUrl, onFailure) {
    this.canvas=canvas;this.url=assetUrl;this.onFailure=onFailure;this.frames=0;this.disposed=false;this.loaded=false;
    this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'low-power',depth:false,stencil:false,preserveDrawingBuffer:false});
    if(!this.gl) throw new Error('WebGL2 is unavailable');
    this.lost=e=>{e.preventDefault();this.loaded=false;canvas.dataset.renderer='lost';onFailure(new Error('WebGL context lost'));};
    this.restore=()=>{this.initialize().catch(onFailure);};
    canvas.addEventListener('webglcontextlost',this.lost);canvas.addEventListener('webglcontextrestored',this.restore);
  }
  async initialize(){
    const gl=this.gl;
    const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(message);}return shader;};
    const vert=compile(gl.VERTEX_SHADER,VS),frag=compile(gl.FRAGMENT_SHADER,FS);this.program=gl.createProgram();gl.attachShader(this.program,vert);gl.attachShader(this.program,frag);gl.linkProgram(this.program);gl.deleteShader(vert);gl.deleteShader(frag);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
    this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const at=gl.getAttribLocation(this.program,'position');gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,2,gl.FLOAT,false,0,0);
    this.u=Object.fromEntries(['picture','resolution','drift','time','reveal','motion','imageAspect'].map(k=>[k,gl.getUniformLocation(this.program,k)]));
    const img=new Image();img.src=this.url;await img.decode();if(this.disposed)return;
    this.imageAspect=img.width/img.height;this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    this.loaded=true;this.resize();this.draw(0,0,[0,0],true);this.canvas.dataset.renderer='ready';
  }
  resize(){const rect=this.canvas.getBoundingClientRect();this.w=Math.max(1,rect.width);this.h=Math.max(1,rect.height);const ratio=Math.min(window.devicePixelRatio||1,1.5,1280/Math.max(this.w,this.h));this.canvas.width=Math.round(this.w*ratio);this.canvas.height=Math.round(this.h*ratio);}
  draw(seconds,progress,drift,reduced){
    if(!this.loaded||this.disposed)return;
    const gl=this.gl;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.useProgram(this.program);gl.bindVertexArray(this.vao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.uniform1i(this.u.picture,0);gl.uniform2f(this.u.resolution,this.canvas.width,this.canvas.height);gl.uniform2f(this.u.drift,...drift);gl.uniform1f(this.u.time,reduced?0:seconds);gl.uniform1f(this.u.reveal,reduced?1:progress);gl.uniform1f(this.u.motion,reduced?0:1);gl.uniform1f(this.u.imageAspect,this.imageAspect);gl.drawArrays(gl.TRIANGLES,0,6);this.frames++;
  }
  dispose(){this.disposed=true;this.loaded=false;const gl=this.gl;gl.deleteTexture(this.texture);gl.deleteBuffer(this.buffer);gl.deleteVertexArray(this.vao);gl.deleteProgram(this.program);this.canvas.removeEventListener('webglcontextlost',this.lost);this.canvas.removeEventListener('webglcontextrestored',this.restore);}
}
