import * as T from 'three';
import {estimateCenterOfMass,qaSequenceAt,createSemanticMotionTimeline,motionDebugOverlayData} from '@soul/animations';

const review=window.masterCharacterReview;
const stage=document.getElementById('stage');
const host=stage?.closest('.canvas-wrap');
let slash=null,lastKey='';
const overlay=document.createElement('canvas');
overlay.id='motion-debug-overlay';overlay.setAttribute('aria-hidden','true');Object.assign(overlay.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'4'});
const badge=document.createElement('output');badge.id='motion-debug-summary';badge.setAttribute('aria-live','polite');Object.assign(badge.style,{position:'absolute',left:'10px',bottom:'10px',maxWidth:'min(72%,420px)',padding:'6px 8px',borderRadius:'8px',background:'rgba(8,18,22,.76)',color:'#eef4ef',font:'11px/1.35 system-ui,sans-serif',whiteSpace:'pre-line',pointerEvents:'none',zIndex:'5'});
if(host){if(getComputedStyle(host).position==='static')host.style.position='relative';host.append(overlay,badge);}
void import(/* @vite-ignore */ new URL('./simulator/src/authored-slash.js',location.href).href).then(mod=>{slash={seconds:mod.SLASH_SECONDS,timing:mod.SLASH_TIMING};}).catch(()=>{});

const world=(actor,name)=>actor?.bones?.[name]?.getWorldPosition(new T.Vector3())??null;
function project(camera,p,width,height){if(!p)return null;const v=new T.Vector3(p.x,p.y,p.z).project(camera);if(!Number.isFinite(v.x+v.y+v.z)||v.z<-1||v.z>1)return null;return{x:(v.x*.5+.5)*width,y:(-.5*v.y+.5)*height};}
function resize(){const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);if(overlay.width!==Math.round(w*dpr)||overlay.height!==Math.round(h*dpr)){overlay.width=Math.round(w*dpr);overlay.height=Math.round(h*dpr);}const ctx=overlay.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return{ctx,w,h};}
function semanticFor(snapshot){if(!slash)return[];const row=qaSequenceAt(snapshot.time);if(row.id!=='slash')return[];const local=row.localTime%2;if(local<0||local>=slash.seconds)return[];const phase=local/slash.seconds,t=createSemanticMotionTimeline({duration:slash.seconds,contactPhase:slash.timing.contact,activeStart:slash.timing.active[0],activeEnd:slash.timing.active[1],plantPhase:slash.timing.plant*.30,handoffPhase:slash.timing.chain});return t.events.filter(e=>Math.abs(e.phase-phase)<.075||e.name==='contact'&&Math.abs(e.phase-phase)<.12);}
function drawLine(ctx,a,b,stroke,width=1.5){if(!a||!b)return;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
function drawPoint(ctx,p,fill,r=4){if(!p)return;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
function render(){
 const qa=review?.motionQA,active=Boolean(qa?.active&&stage&&host);overlay.hidden=!active;badge.hidden=!active;if(!active){lastKey='';requestAnimationFrame(render);return;}
 const snapshot=qa.snapshot(),actor=review.actors?.[review.settings?.selected??0];if(!actor){requestAnimationFrame(render);return;}actor.root.updateWorldMatrix(true,true);
 const points={hips:world(actor,'hips'),chest:world(actor,'chest'),head:world(actor,'head'),leftHand:world(actor,'leftHand'),rightHand:world(actor,'rightHand'),leftFoot:world(actor,'leftFoot'),rightFoot:world(actor,'rightFoot')};let com=null;try{com=estimateCenterOfMass(points);}catch{}
 const semantic=semanticFor(snapshot),data=motionDebugOverlayData({centerOfMass:com,supports:[points.leftFoot,points.rightFoot].filter(Boolean),semanticEvents:semantic});
 const {ctx,w,h}=resize();ctx.clearRect(0,0,w,h);const camera=new T.PerspectiveCamera(38,w/h,.01,120);camera.position.fromArray(snapshot.cameraPosition);camera.lookAt(new T.Vector3().fromArray(snapshot.cameraTarget));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 const supports=data.supports.map(p=>project(camera,p,w,h)),center=project(camera,data.centerOfMass,w,h);if(supports.length===2)drawLine(ctx,supports[0],supports[1],'rgba(116,214,226,.92)',2);supports.forEach(p=>drawPoint(ctx,p,'rgba(116,214,226,.96)',4));drawPoint(ctx,center,'rgba(220,196,147,.98)',5);
 if(center&&supports.length){const target={x:supports.reduce((n,p)=>n+p.x,0)/supports.length,y:supports.reduce((n,p)=>n+p.y,0)/supports.length};drawLine(ctx,center,target,'rgba(220,196,147,.62)',1);}
 const row=qaSequenceAt(snapshot.time),eventText=semantic.length?semantic.map(e=>e.name).join(' · '):'none',key=`${row.frame}:${snapshot.camera}:${eventText}`;if(key!==lastKey){badge.textContent=`Motion Debug · ${row.label} / frame ${row.frame}\nCOM ●  支持足 ●─●  Semantic: ${eventText}\nFuture / Interaction / Hit: gameplay input時のみ`;lastKey=key;}
 requestAnimationFrame(render);
}
if(stage&&host)requestAnimationFrame(render);
