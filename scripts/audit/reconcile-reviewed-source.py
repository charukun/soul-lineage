# Explicitly reconcile the concurrent public notebook into the verified plan.
# This helper runs only on the isolated validation branch; final app blobs are
# reviewed and transferred to the Lab only after all real-model checks pass.
from pathlib import Path
import subprocess,hashlib
r=Path.cwd()
def blob(path):
 b=(r/path).read_bytes();return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
assert blob('apps/rinne/src/review/main.js')=='c83be5d5d37da23955b32b6f08f6510eefa40ab9','Unexpected main source'
assert blob('apps/rinne/src/review/review-adapter-base.js')=='59e3b4143490aa1390456438e0838c9c1a5f8c63','Unexpected adapter source'
for path in ['apps/rinne/review.html','apps/rinne/src/review/notebook.css','apps/rinne/src/review/notebook.js','apps/rinne/src/review/posture-preview.js','apps/rinne/src/review/review-contract.js','tests/review-posture.test.mjs','tests/review-workflow.test.mjs']:
 p=r/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(subprocess.check_output(['git','show','fb670ea424628c3311dd91ddc1edcfc9e24c1759:'+path]))
def edit(path,old,new):
 p=r/path;s=p.read_text();assert s.count(old)==1,(path,s.count(old),old[:90]);p.write_text(s.replace(old,new))
main='apps/rinne/src/review/main.js'
edit(main,"import { createPlayback, markerAge } from './playback.js';","import { createPlayback, markerAge } from './playback.js';\nimport { sequenceDuration, sequenceFrame } from './review-contract.js';")
edit(main,"let body=null,mixer=null,action=null,activeClip=null,loading=null,generation=0;","let body=null,mixer=null,action=null,activeClip=null,loading=null,generation=0;\n  let sequence=[],sequenceNames=[],sequenceIndex=-1,restoringSequence=false;")
edit(main,"function clearBody(){clearHelpers();","function clearBody(){sequence=[];sequenceNames=[];sequenceIndex=-1;clearHelpers();")
edit(main,"function currentState(){return{...state,time:clock.time,speed:clock.speed,loop:clock.loop,playing:clock.playing};}","function currentState(){return{...state,sequence:[...sequenceNames],time:clock.time,speed:clock.speed,loop:clock.loop,playing:clock.playing};}")
edit(main,"    body?.resetPose?.();\n    if(action){action.enabled=true;action.paused=false;action.time=clock.time;mixer.update(0);if(body.resetPose)sampleRawClip(activeClip,body.root,clock.time);}\n    weapon();body?.afterSample?.(clock.time,state.clip,state);body?.root.updateMatrixWorld(true);\n    const age=state.vfx&&activeClip?markerAge(clock.time,state.marker,clock.duration,clock.loop):Infinity;",'''    const frame=sequenceFrame(sequence,clock.time);
    if(frame&&frame.index!==sequenceIndex){
      const subsequent=sequenceIndex>=0;
      mixer.stopAllAction();sequenceIndex=frame.index;activeClip=sequence[frame.index];state.clip=sequenceNames[frame.index];
      if(subsequent&&!restoringSequence){const loop=clock.loop;Object.assign(state,applyMotionPolicy(state,metaFor(state.clip)));state.loop=loop;}
      action=mixer.clipAction(activeClip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.reset().play();
      q('#clip').value=state.clip;q('#clip-label').textContent=state.clip;syncControls();
      document.dispatchEvent(new CustomEvent('review-sequence-frame',{detail:{index:frame.index,names:[...sequenceNames]}}));
    }
    body?.resetPose?.();
    const localTime=frame?.time||0;
    if(action){action.enabled=true;action.paused=false;action.time=localTime;mixer.update(0);if(body.resetPose)sampleRawClip(activeClip,body.root,localTime);}
    weapon();body?.afterSample?.(localTime,state.clip,state);body?.root.updateMatrixWorld(true);
    const age=state.vfx&&activeClip?markerAge(localTime,state.marker,activeClip.duration,clock.loop&&sequence.length===1):Infinity;''')
p=r/main;s=p.read_text();a=s.index('  function playClip(');b=s.index('  function attach(',a)
s=s[:a]+'''  function playSequence(names,autoplay=true,restore=false){
    if(!body)throw new Error('モデルの読み込み完了後に再生してください');
    if(!Array.isArray(names)||names.length>3||names.some(name=>typeof name!=='string'||!name))throw new Error('再生モーションの指定が不正です');
    // Resolve every stage before touching current playback; never skip missing stages.
    const clips=names.map(name=>{const clip=body.getClip(name,{inPlace:state.inPlace});if(!clip)throw new Error(`Source animation not found: ${name}`);return clip;});
    const duration=sequenceDuration(clips);
    if(!restore){Object.assign(state,applyMotionPolicy(state,metaFor(names[0])));clock.loop=names.length>1?false:state.loop;state.loop=clock.loop;}
    mixer.stopAllAction();action=null;activeClip=null;sequence=clips;sequenceNames=[...names];sequenceIndex=-1;
    state.sequence=[...names];state.clip=names[0]||'';clock.time=0;clock.duration=duration;clock.playing=autoplay&&clips.length>0;
    if(!names.length){q('#clip').value='';q('#clip-label').textContent='元モデル静止比較';document.dispatchEvent(new CustomEvent('review-sequence-frame',{detail:{index:0,names:[]}}));}
    restoringSequence=restore;syncControls();sample();restoringSequence=false;
  }
  function playClip(name,autoplay=true,restore=false){playSequence(name?[name]:[],autoplay,restore);}
  function restoreSelection(){
    const names=state.sequence?.length?[...state.sequence]:[state.clip||'通常 / 自然体'];
    if(!names.every(n=>body.clipNames.includes(n)))return false;
    const savedTime=state.time,savedClip=state.clip,playing=state.playing;
    playSequence(names,playing,true);clock.time=Math.min(savedTime,clock.duration);
    restoringSequence=true;sample();restoringSequence=false;return true;
  }
''' +s[b:]
s=s.replace("    const wanted=state.clip||'通常 / 自然体',savedTime=state.time;\n    if(body.clipNames.includes(wanted)){playClip(wanted,state.playing,true);clock.time=Math.min(savedTime,clock.duration);}\n    else{clock.playing=false;setStatus('指定モーションを読み込み中');}","    if(!restoreSelection()){clock.playing=false;setStatus('指定モーションを読み込み中');}")
s=s.replace("state.time=clock.time;state.playing=clock.playing;const token=", "if(body){state.sequence=[...sequenceNames];}state.time=clock.time;state.playing=clock.playing;const token=")
s=s.replace("  new MutationObserver(()=>{if(body&&!activeClip&&body.clipNames.includes(state.clip)){const t=state.time;playClip(state.clip,state.playing,true);clock.time=Math.min(t,clock.duration);sample();}}).observe(q('#clip'),{childList:true,subtree:true});", "  new MutationObserver(()=>{if(body&&!activeClip)restoreSelection();}).observe(q('#clip'),{childList:true,subtree:true});\n  document.addEventListener('review-play-sequence',wrap(event=>{state.shared=false;playSequence(event.detail?.names);}));")
s=s.replace("playClip(state.clip,clock.playing,true);clock.time=t;sample();", "playSequence([...sequenceNames],clock.playing,true);clock.time=t;restoringSequence=true;sample();restoringSequence=false;")
s=s.replace("clock.seek(phases[index][1]);sample();", "clock.seek((sequenceFrame(sequence,clock.time)?.offset||0)+phases[index][1]);sample();")
s=s.replace("clock.seek(Math.min(clock.duration,numeric('#overlay-time',.42)+.02));", "clock.seek((sequenceFrame(sequence,clock.time)?.offset||0)+Math.min(activeClip.duration,numeric('#overlay-time',.42)+.02));")
s=s.replace("`Clip: ${activeClip?.name||'rest'}`", "`Clip: ${activeClip?.name||'rest'}`,`Sequence: ${sequenceNames.join(' → ')||'rest'}`")
s=s.replace("  q('#copy-review').addEventListener('click',wrap(()=>copy(stateText())));", "  // notebook.js owns the editable feedback dialog, including its explicit Copy action.")
s=s.replace("animations:body?.clipNames||[]", "sequence:[...sequenceNames],sequenceIndex,playing:clock.playing,duration:clock.duration,loop:clock.loop,speed:clock.speed,localTime:sequenceFrame(sequence,clock.time)?.time||0,posture:body?.postureDiagnostics||null,animations:body?.clipNames||[]")
s=s.replace("}),stateText,metadata:","}),stateText,stateURL:()=>reviewStateURL(location.href,currentState()).href,metadata:")
p.write_text(s)
st='apps/rinne/src/review/review-state.js'
edit(st,"return{version:2,preset:","const sequence=p.getAll('stage').filter(n=>n&&n.length<=200).slice(0,3);\n return{version:2,sequence,preset:")
edit(st,"for(const[k,v]of Object.entries(fields))u.searchParams.set(k,String(v));return u;", "for(const[k,v]of Object.entries(fields))u.searchParams.set(k,String(v));for(const stage of state.sequence||[])u.searchParams.append('stage',stage);return u;")
edit(st,"if(meta.weapon==='none')next.weaponEnabled=false;", "if(meta.weapon==='none')next.weaponEnabled=false;\n if(meta.kind==='draw'||meta.kind==='sheathe'){next.weaponId='sword';next.weaponEnabled=true;}")
p=r/'apps/rinne/src/review/review-adapter-base.js';s=p.read_text();s=s.replace("import { installReviewUX } from './review-ux.js';","import { installReviewUX } from './review-ux.js';\nimport { bakePosturePreview } from './posture-preview.js';")
anchor="      for(const row of MASTER_TECHNIQUES)"
extra='''      try{
        body.posturePreviews=new Map();
        for(const row of bakePosturePreview(runtime)){
          const mapped=remapClip(row.clip,runtime.current.bones,targetBones,row.name);
          clips.set(row.name,mapped);body.posturePreviews.set(row.name,{...row,clip:mapped});
          register(row.name,{category:'blade',posture:row.kind==='draw'?'combat':'normal',weapon:'sword',kind:row.kind,loop:false,phases:[['開始',0],['持ち替え',row.transferTime],['収まり',1.25],['完了',1.4]]});
          body.clipNames.push(row.name);appendClip('ゲーム共通 / 抜刀・納刀',row.name);loaded++;
        }
      }catch(error){failed++;failAsset('Posture previews',error);console.error('Posture preview generation failed',error);}
'''
assert s.count(anchor)==1;s=s.replace(anchor,extra+anchor);p.write_text(s)
p=r/'apps/rinne/src/review/review-adapter.js';s=p.read_text();s=s.replace("import { installWeaponReviewPolish }", "import { installPostureWeaponPreview } from './posture-preview.js';\nimport { installWeaponReviewPolish }");s=s.replace('installWeaponReviewPolish(await base.loadPreset(args))','installPostureWeaponPreview(installWeaponReviewPolish(await base.loadPreset(args)))');p.write_text(s)
p=r/'apps/rinne/src/review/posture-preview.js';s=p.read_text();a=s.index('export function installPostureWeaponPreview(')
s=s[:a]+'''export function installPostureWeaponPreview(body) {
  const hand=body.bones?.rightHand,hips=body.bones?.hips,socket=hand?.getObjectByName('ReviewWeaponPolishedSocket');
  if(!hand||!hips||!socket)return body;
  const originalAfter=body.afterSample?.bind(body);let signature='',calibrated=null;
  const nodes=new Map(Object.values(body.bones).map(b=>[b.uuid,b]));
  function carryMatrix(row,handMatrix){
    const saved=Object.values(body.bones).map(b=>[b,b.position.clone(),b.quaternion.clone()]);
    try {
      for(const track of row.clip.tracks){const dot=track.name.lastIndexOf('.'),n=nodes.get(track.name.slice(0,dot)),p=track.name.slice(dot+1);if(n&&['position','quaternion'].includes(p))n[p].fromArray(track.createInterpolant().evaluate(row.transferTime));}
      body.root.updateMatrixWorld(true);
      return hips.matrixWorld.clone().invert().multiply(hand.matrixWorld).multiply(handMatrix);
    }finally{for(const[b,p,q]of saved){b.position.copy(p);b.quaternion.copy(q);}body.root.updateMatrixWorld(true);}
  }
  body.afterSample=(time,name,state)=>{
    const matrix=body.weaponHandMatrix?.();
    if(matrix){if(socket.parent!==hand)hand.add(socket);matrix.decompose(socket.position,socket.quaternion,socket.scale);}
    originalAfter?.(time,name,state);
    const row=body.posturePreviews?.get(name);const amount=row?postureAmount(row.kind,time):1;
    if(row&&matrix&&socket.visible&&amount<=.25){
      const key=row.name+':'+matrix.elements.join(',');if(key!==signature){calibrated=carryMatrix(row,matrix);signature=key;}
      hips.add(socket);calibrated.decompose(socket.position,socket.quaternion,socket.scale);socket.updateMatrixWorld(true);
    }
    body.postureDiagnostics=row?{kind:row.kind,amount,attachment:socket.parent===hips?'hips':'hand',time}:null;
  };
  const oldDispose=body.dispose?.bind(body);body.dispose=()=>{body.posturePreviews?.clear();oldDispose?.();};
  return body;
}
''';p.write_text(s)
m='apps/rinne/src/review/martial-motion.js';p=r/m;s=p.read_text().replace("import { solveTwoBone } from './pose-transfer.js';","import { solveTwoBone } from './pose-transfer.js';\nimport { createHandClosure } from './hand-shape.js';")
s=s.replace('  const reset=()=>','  const closures=Object.fromEntries([\'left\',\'right\'].map(side=>[side,createHandClosure(bones,side)]));\n  const reset=()=>')
a=s.index("    for(const finger of ['Index'",s.index('  function fist('));b=s.index('\n  function evaluate',a)
s=s[:a]+"    closures[side](1);\n  }"+s[b:];p.write_text(s)
w='apps/rinne/src/review/weapon-review-polish.js';p=r/w;s=p.read_text().replace("import { solveTwoBone } from './pose-transfer.js';","import { solveTwoBone } from './pose-transfer.js';\nimport { createHandClosure } from './hand-shape.js';")
s=s.replace(" const palms={right:calibratedPalm(body.bones,'right'),left:calibratedPalm(body.bones,'left')};", " const palms={right:calibratedPalm(body.bones,'right'),left:calibratedPalm(body.bones,'left')};\n const closures=Object.fromEntries(['right','left'].map(side=>[side,createHandClosure(body.bones,side)]));")
a=s.index(' function curl(');b=s.index('\n function handAt(',a);s=s[:a]+" function curl(side){closures[side](.88);}"+s[b:]
s=s.replace(" body.weaponDiagnostics=null;", " body.weaponDiagnostics=null;\n body.weaponHandMatrix=()=>new T.Matrix4().compose(palms.right.offset,palms.right.rotation.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(rad(config.x),rad(config.y),rad(config.z)))),vec(1,1,1));")
s=s.replace("if(spec.support&&!normal){","if(spec.support&&!normal&&!body.posturePreviews?.has(clip)){")
p.write_text(s)
u='apps/rinne/src/review/review-controls.js';p=r/u;s=p.read_text();a=s.index(" const modes=make('div'");b=s.index(" q('.review-tabs')",a)
s=s[:a]+" const modes=q('#posture-modes');if(modes){modes.setAttribute('aria-label','通常と戦闘の切り替え');head.append(modes);}\n"+s[b:]
s=s.replace("quick.append(camera);camera.setAttribute", "quick.append(camera);camera.append(q('#copy-motion'));camera.setAttribute")
p.write_text(s)
p=r/'apps/rinne/src/review/notebook.js';s=p.read_text();a=s.index('function modeMotion(');b=s.index('\n// Keep the existing motion picker',a)
s=s[:a]+'''function modeMotion(mode) {
  return allOptions().find(o=>o.value===(mode==='combat'?'Tidebreak / Idle':'通常 / 自然体'))?.value;
}
''' +s[b:]
a=s.index("document.querySelectorAll('[data-combat-mode]').forEach(button => button.addEventListener");b=s.index("\n\nconst dialog",a)
s=s[:a]+'''document.querySelectorAll('[data-combat-mode]').forEach(button=>button.addEventListener('click',()=>{
  document.dispatchEvent(new CustomEvent('review-combat-mode',{detail:{mode:button.dataset.combatMode}}));
}));''' +s[b:]
s=s.replace("loop: q('#loop-toggle').checked, url: location.href","loop: q('#loop-toggle').checked, url: window.__reviewLab?.stateURL?.() || location.href")
p.write_text(s)
p=r/'apps/rinne/src/review/review-controls.css';s=p.read_text()+'''
/* Concurrent notebook controls keep their behavior within the bounded main panel. */
.review-shell .notebook-head #posture-modes{margin:0;flex-wrap:nowrap}
.review-shell .notebook-head #posture-modes button{min-height:36px;padding:3px 7px;font-size:10px}
.quick-review .camera-strip{grid-template-columns:repeat(6,minmax(0,1fr)) minmax(54px,1.2fr)}
.quick-review #copy-motion{font-size:10px;min-height:36px;white-space:nowrap}
''';p.write_text(s)
for path,expected in [(main,'dac0d2790d844c5f91cb40bca62e210eed27b7e0'),('apps/rinne/src/review/review-adapter-base.js','f5da3d70763d33349909271a3f0d50d49cdbdb35'),('apps/rinne/src/review/notebook.js','6f4ee7ffbc8633f1de61fb2c655b3c4c7d4c5ca0'),('apps/rinne/src/review/posture-preview.js','13a2ed98d8509caa8afdef057421910144066baa')]:assert blob(path)==expected,(path,blob(path),expected)
print('Concurrent notebook, posture and feedback reconciled without discarding existing features')
