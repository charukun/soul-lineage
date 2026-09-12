# Diagnostic-branch source materializer. Exact input and output Git blob checks
# prevent accidental modification of an unknown/concurrently edited revision.
from pathlib import Path
import hashlib

def blob(path):
 b=Path(path).read_bytes()
 return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
paths=['apps/rinne/src/review/main.js','apps/rinne/src/review/review-adapter-base.js']
expected=['ca18373f1f1447a74888fd3b630a1318ad7df5a3','59e3b4143490aa1390456438e0838c9c1a5f8c63']
if [blob(p) for p in paths]==expected:
 print('Source already materialized');raise SystemExit(0)
assert [blob(p) for p in paths]==['ea775a5a5c3923d0f26c76497b18eed2a31aab35','4d9ff62d1866b1c68bfb1ee148d7a57e9c7316a4'],'Unexpected base source; do not overwrite'

from pathlib import Path
import json,hashlib
root=Path.cwd()
f=root/'apps/rinne/src/review/review-adapter-base.js';s=f.read_text()
s=s.replace("import { installReviewUX } from './review-ux.js';", "import { installReviewUX } from './review-ux.js';\nimport { rawClipFromNormalized } from './pose-transfer.js';\nimport { createMartialClips, STRAIGHT_PUNCH } from './martial-motion.js';\nimport { REVIEW_MOTION_INTEGRITY } from './review-motion-integrity.js';\nconst sourceVRMForBones = new WeakMap();")
start=s.index('function remapClip(');end=s.index('function poseClip(',start)
s=s[:start]+'''function remapClip(sourceClip,sourceBones,targetBones,name=sourceClip.name){
  const vrm=sourceVRMForBones.get(sourceBones);
  if(!vrm)throw new Error('Missing normalized source VRM registration');
  return rawClipFromNormalized(sourceClip,sourceBones,vrm,targetBones,name);
}
'''+s[end:]
s=s.replace('const authored=motionsModule.createRetargetedClips(vrm),clips=new Map()', 'const authored=motionsModule.createRetargetedClips(vrm);sourceVRMForBones.set(authored.bones,vrm);const martial=createMartialClips(vrm);authored.clips.Attack=martial.Attack;visible.scene.quaternion.copy(vrm.scene.quaternion);visible.scene.updateMatrixWorld(true);const clips=new Map()')
old="  const bodyAliases=["
s=s.replace(old,"  clips.set('通常 / 自然体',remapClip(martial.NormalIdle,authored.bones,targetBones,'通常 / 自然体'));\n"+old)
s=s.replace('const weapons=new Map(),pendingWeapons=new Map();','const weapons=new Map(),pendingWeapons=new Map(),assetProblems=[];\n  const failAsset=(id,error)=>{assetProblems.push({id,reason:String(error?.message||error)});document.dispatchEvent(new Event(\'review-assets-changed\'));};')
s=s.replace("summary:'MasterCharacter共有Humanoidを使用可能。残りを優先順に読み込み中。'", "summary:'基本動作を使用可能。追加モーションを読み込み中。',assetProblems,motionMeta:new Map(),poseTransfer:'official-normalized-to-raw',sourceVRM:vrm")
s=s.replace("  let loaded=authoredNames.length+bodyAliases.length;", """  const register=(id,meta)=>body.motionMeta.set(id,{id,source:body.label,...meta});
  register('通常 / 自然体',{category:'life',posture:'normal',loop:true});
  register('Tidebreak / Idle',{category:'defense',posture:'combat',loop:true});
  register('Tidebreak / Attack',{category:'unarmed',posture:'combat',loop:false,weapon:'none',duration:STRAIGHT_PUNCH.duration,phases:STRAIGHT_PUNCH.phases});
  for(const id of ['Tidebreak / Walk','Tidebreak / Run','体 / 歩行','体 / ダッシュ'])register(id,{category:'move',loop:true});
  for(const id of ['Tidebreak / Hit Reaction','体 / 被弾'])register(id,{category:'defense',loop:false});
  const restNodes=[];visible.scene.traverse(node=>restNodes.push({node,p:node.position.clone(),q:node.quaternion.clone()}));
  body.resetPose=()=>{for(const {node,p,q}of restNodes){node.position.copy(p);node.quaternion.copy(q);}};
  let loaded=authoredNames.length+bodyAliases.length;""")
s=s.replace("const runtime=new humanoidModule.HumanoidRuntime", "const runtime=new humanoidModule.HumanoidRuntime")
s=s.replace("await runtime.load(model.runtimeId||model.label);", "await runtime.load(model.runtimeId||model.label);sourceVRMForBones.set(runtime.current.bones,runtime.current.vrm);if(disposed||signal.aborted){runtime.dispose(runtime.current);return;}")
s=s.replace("body.clipNames.push(value);appendClip('MasterCharacter共有Humanoid / 技'", "register(value,{category:row.weapon==='fist'?'unarmed':'blade',posture:'combat',weapon:row.weapon==='fist'?'none':row.weapon,kind:row.kind,loop:false,phases:row.kind==='slash'?[['構え',0],['打ち出し',.27],['打点',.49],['戻り',.84]]:null});body.clipNames.push(value);appendClip('MasterCharacter共有Humanoid / 技'")
s=s.replace("body.clipNames.push(value);appendClip('MasterCharacter共有Humanoid / 防御'", "register(value,{category:'defense',posture:'combat',kind:row.kind,loop:false});body.clipNames.push(value);appendClip('MasterCharacter共有Humanoid / 防御'")
s=s.replace("body.clipNames.push(alias);appendClip('パリィ候補'", "register(alias,{category:'defense',posture:'combat',loop:false});body.clipNames.push(alias);appendClip('パリィ候補'")
s=s.replace("body.clipNames.push(value);appendClip('MasterCharacter共有Humanoid / 構え'", "register(value,{category:'defense',posture:'combat',loop:true});body.clipNames.push(value);appendClip('MasterCharacter共有Humanoid / 構え'")
s=s.replace("body.clipNames.push(mind);appendClip('心技体 / 心'", "register(mind,{category:'defense',posture:'combat',loop:true});body.clipNames.push(mind);appendClip('心技体 / 心'")
s=s.replace("body.clipNames.push(value);appendClip('ゲーム共通 / VRMA'", "if(disposed||signal.aborted)return;register(value,{category:['walk','run-slow'].includes(item.id)?'move':'life',loop:true});body.clipNames.push(value);appendClip('ゲーム共通 / VRMA'")
s=s.replace("failed++;console.warn(`Shared VRMA skipped: ${item.id}`,error);", "failed++;failAsset(item.id,error);console.warn(`Shared VRMA unavailable: ${item.id}`,error);")
s=s.replace("failed++;console.error('MasterCharacter shared Humanoid motion generation failed',error);", "failed++;failAsset('MasterCharacter techniques',error);console.error('MasterCharacter shared Humanoid motion generation failed',error);")
s=s.replace("    try{\n      const response=externalManifest?", "    if(!visible.parser.json.extensions?.VRMC_vrm?.humanoid){failAsset('external:Quaternius','この比較用リターゲッターはVRM 1のみ対応。基本動作・共有VRMAは利用可能です。');updateSummary(loaded,null,assetProblems.length);return;}\n    try{\n      const response=externalManifest?")
s=s.replace("body.clipNames.push(value);appendClip('外部Asset比較 / Quaternius'", "register(value,{category:'external',loop:true});body.clipNames.push(value);appendClip('外部Asset比較 / Quaternius'")
s=s.replace("failed++;console.error(error);progressUI('外部比較モーション読込失敗'", "failed++;failAsset('external:Quaternius',error);console.error(error);progressUI('外部比較モーション読込失敗'")
s=s.replace('motionCatalogModule,humanoidModule]=await Promise.all(', 'motionCatalogSource,humanoidModule]=await Promise.all(')
s=s.replace('  installReviewUX({reviewPresets,reviewWeapons});', "  const motionCatalogModule={default:motionCatalogSource.default.map(row=>({...row,...REVIEW_MOTION_INTEGRITY[row.id]}))};\n  installReviewUX({reviewPresets,reviewWeapons});")
s=s.replace('{expectedSize:item.bytes', '{sha256:item.reviewSHA256,expectedSize:item.bytes')
s=s.replace('{expectedSize:row.bytes}', '{sha256:row.reviewSHA256,expectedSize:row.bytes}')
f.write_text(s)
manifest=(root/'apps/rinne/public/simulator/src/motion-catalog.js').read_text()
rows=json.loads(manifest.split('export default ',1)[1].rstrip().rstrip(';'))
ledger={}
for r in rows:
 b=(root/'apps/rinne/public/simulator'/r['file']).read_bytes();h=hashlib.sha256(b).hexdigest()
 assert h==r['reviewSHA256'],(r['id'],h,r['reviewSHA256'])
 ledger[r['id']]={'bytes':len(b),'reviewSHA256':h}
(root/'apps/rinne/src/review/review-motion-integrity.js').write_text('/** Byte lengths of the checked-in review conversions, not original source files. */\nexport const REVIEW_MOTION_INTEGRITY = Object.freeze('+json.dumps(ledger,indent=2)+');\n')
print('review conversions',[(r['id'],r['bytes'],ledger[r['id']]['bytes'])for r in rows if r['bytes']!=ledger[r['id']]['bytes']])

from pathlib import Path
p=root/'apps/rinne/src/review/main.js';s=p.read_text()
s=s.replace("import './style.css';", "import './style.css';\nimport { readReviewState, reviewStateURL, applyMotionPolicy } from './review-state.js';\nimport { installFocusedReviewUI } from './review-controls.js';\nimport './review-controls.css';")
s=s.replace('const clock = createPlayback();', "const state=readReviewState(params);\nconst clock=Object.assign(createPlayback(),{time:state.time,speed:state.speed,loop:state.loop,playing:state.playing});")
s=s.replace('const extensions=await installReviewExtensions({scene});', 'const extensions=await installReviewExtensions({scene});\n  installFocusedReviewUI();')
s=s.replace("if(!body)return;cameraName=name;", "if(!body)return;cameraName=name;state.camera=name;")
a=s.index('  function weapon(){');b=s.index('  function playClip(',a)
s=s[:a]+'''  function currentState(){return{...state,time:clock.time,speed:clock.speed,loop:clock.loop,playing:clock.playing};}
  function metaFor(name=state.clip){const meta=body?.motionMeta?.get(name);return meta?.kind==='slash'?{...meta,phases:meta.phases?.map(([label,t])=>[label,t*1.28])}:meta;}
  function syncControls(){
    q('#weapon-select').value=state.weaponId;q('#weapon-toggle').checked=state.weaponEnabled;
    for(const [key,id]of [['weaponScale','#weapon-scale'],['weaponX','#weapon-x'],['weaponY','#weapon-y'],['weaponZ','#weapon-z']])q(id).value=String(state[key]);
    q('#loop-toggle').checked=clock.loop;q('#speed').value=String(clock.speed);q('#in-place').checked=state.inPlace;
    q('#overlay-time').value=String(state.marker);q('#overlay-toggle').checked=state.vfx;
    for(const button of document.querySelectorAll('[data-combat-mode]')){const on=button.dataset.combatMode===state.mode;button.classList.toggle('active',on);button.setAttribute('aria-pressed',String(on));}
    for(const button of document.querySelectorAll('[data-weapon]'))button.classList.toggle('active',button.dataset.weapon===(state.weaponEnabled?state.weaponId:'none'));
  }
  function weapon(){const current=body;if(!current?.setWeapon)return;Promise.resolve(current.setWeapon({enabled:state.weaponEnabled,id:state.weaponId,scale:state.weaponScale,x:state.weaponX,y:state.weaponY,z:state.weaponZ})).catch(error=>{if(body===current)setStatus('武器読込失敗: '+error.message,'error');});}
  function sample(){
    body?.resetPose?.();
    if(action){action.enabled=true;action.paused=false;action.time=clock.time;mixer.update(0);}
    weapon();body?.afterSample?.(clock.time,state.clip,state);body?.root.updateMatrixWorld(true);
    const age=state.vfx&&activeClip?markerAge(clock.time,state.marker,clock.duration,clock.loop):Infinity;
    body?.sampleEffects?.(age);
    q('#timeline').max=String(clock.duration||1);q('#timeline').value=String(clock.time);
    q('#current-time').textContent=`${clock.time.toFixed(3)}s`;q('#duration').textContent=`${clock.duration.toFixed(3)}s`;
    q('#play-toggle').textContent=clock.playing?'一時停止':'再生';
    if(bounds&&body)bounds.box.setFromObject(body.root);
    document.dispatchEvent(new CustomEvent('review-state-change',{detail:{state:currentState(),meta:metaFor(),problems:body?.assetProblems||[],weapon:body?.weaponDiagnostics||null,loaded:!!body}}));
  }
''' + s[b:]
s=s.replace('function playClip(name,autoplay=true){', 'function playClip(name,autoplay=true,restore=false){')
s=s.replace("    if(!body)return;\n    mixer.stopAllAction();", "    if(!body)return;\n    if(!restore){Object.assign(state,applyMotionPolicy(state,metaFor(name)));clock.loop=state.loop;}\n    state.clip=name;\n    mixer.stopAllAction();")
s=s.replace("q('#clip').value=name||'';q('#clip-label').textContent=name||'元モデル静止比較';sample();", "q('#clip').value=name||'';q('#clip-label').textContent=name||'元モデル静止比較';syncControls();sample();")
a=s.index("    const wanted=params.get('clip')");b=s.index('\n  }\n  async function loadPreset',a)
s=s[:a]+'''    const wanted=state.clip||'通常 / 自然体',savedTime=state.time;
    if(body.clipNames.includes(wanted)){playClip(wanted,state.shared?state.playing:true,true);clock.time=Math.min(savedTime,clock.duration);}
    else{clock.playing=false;setStatus('指定モーションを読み込み中');}
    wireframe();refreshHelpers();frameModel(state.camera);syncControls();sample();
    document.dispatchEvent(new CustomEvent('review-model-loaded',{detail:{presetId:state.preset}}));
    setStatus('基本素材を表示中。追加素材は準備状況から確認できます。');
''' +s[b:]
s=s.replace("q('#preset').value=presetId;q('#model-url').value='';", "q('#preset').value=presetId;state.preset=presetId;q('#model-url').value='';")
s=s.replace("q('#clip').addEventListener('change',wrap(()=>playClip(q('#clip').value)));", "q('#clip').addEventListener('change',wrap(()=>{state.shared=false;state.time=0;playClip(q('#clip').value);}));\n  new MutationObserver(()=>{if(body&&!activeClip&&body.clipNames.includes(state.clip)){const t=state.time;playClip(state.clip,state.playing,true);clock.time=Math.min(t,clock.duration);sample();}}).observe(q('#clip'),{childList:true,subtree:true});")
s=s.replace("q('#loop-toggle').checked;sample();", "q('#loop-toggle').checked;state.loop=clock.loop;sample();")
s=s.replace("clock.speed=Math.max(.1,Math.min(2,numeric('#speed',1)));", "clock.speed=Math.max(.1,Math.min(2,numeric('#speed',1)));state.speed=clock.speed;")
s=s.replace("q('#in-place').addEventListener('change',wrap(()=>playClip(activeClip?.name||'',clock.playing)));", "q('#in-place').addEventListener('change',wrap(()=>{state.inPlace=q('#in-place').checked;const t=clock.time;playClip(state.clip,clock.playing,true);clock.time=t;sample();}));")
s=s.replace("for(const id of ['#weapon-toggle','#weapon-scale','#weapon-x','#weapon-y','#weapon-z','#overlay-toggle','#overlay-time'])q(id).addEventListener('input',sample);", """for(const id of ['#weapon-toggle','#weapon-select','#weapon-scale','#weapon-x','#weapon-y','#weapon-z','#overlay-toggle','#overlay-time'])q(id).addEventListener('input',()=>{
    state.weaponEnabled=q('#weapon-toggle').checked;state.weaponId=q('#weapon-select').value;
    state.weaponScale=numeric('#weapon-scale',.5);state.weaponX=numeric('#weapon-x');state.weaponY=numeric('#weapon-y');state.weaponZ=numeric('#weapon-z');state.vfx=q('#overlay-toggle').checked;state.marker=numeric('#overlay-time',.42);syncControls();sample();
  });
  document.addEventListener('review-combat-mode',event=>{state.mode=event.detail.mode==='combat'?'combat':'normal';state.time=0;playClip(state.mode==='combat'?'Tidebreak / Idle':'通常 / 自然体',true,true);clock.loop=true;syncControls();sample();});
  document.addEventListener('review-phase',event=>{const phases=metaFor()?.phases||[],index=Number(event.detail.index);if(phases[index]){clock.seek(phases[index][1]);sample();}});""")
s=s.replace("q('#overlay-toggle').checked=true;clock.seek", "q('#overlay-toggle').checked=true;state.vfx=true;clock.seek")
s=s.replace("`Weapon: ${q('#weapon-toggle').checked} / scale ${q('#weapon-scale').value}", "`Posture: ${state.mode}`,`Loop: ${clock.loop}`,`Weapon: ${state.weaponId} / ${state.weaponEnabled} / scale ${q('#weapon-scale').value}")
a=s.index("  q('#copy-link').addEventListener");b=s.index("  q('#capture').addEventListener",a)
s=s[:a]+'''  q('#copy-link').addEventListener('click',wrap(()=>{
    const url=reviewStateURL(location.href,currentState());
    if(q('#model-url').value)url.searchParams.set('model',q('#model-url').value);
    history.replaceState(null,'',url);return copy(url.href);
  }));
'''+s[b:]
a=s.index("  for(const [key,id]of [['marker'");b=s.index('  window.__reviewLab=',a)
s=s[:a]+"  syncControls();\n"+s[b:]
s=s.replace("source:body?.label||null,build:build.commit,", "source:body?.label||null,build:build.commit,state:currentState(),metadata:body?.motionMeta?[...body.motionMeta]:[],assetProblems:body?.assetProblems||[],weapon:body?.weaponDiagnostics||null,poseTransfer:body?.poseTransfer||null,")
s=s.replace("}),stateText};", "}),stateText,metadata:()=>body?.motionMeta?[...body.motionMeta]:[],seek:time=>{clock.seek(time);sample();},frame:frameModel};")
p.write_text(s)
p=root/'apps/rinne/src/review/review-adapter-base.js';s=p.read_text();s=s.replace("  {id:'axe',label:","  {id:'katana',label:'刀',local:true},\n  {id:'axe',label:")
s=s.replace("for(const weapon of reviewWeapons){try{", "for(const weapon of reviewWeapons){if(weapon.local){done++;continue;}try{")
p.write_text(s)

p=root/paths[0];s=p.read_text()
s=s.replace("  async function loadPreset(presetId=q('#preset').value||reviewPresets[0].id){\n    const token=", "  async function loadPreset(presetId=q('#preset').value||reviewPresets[0].id){\n    state.time=clock.time;state.playing=clock.playing;const token=")
s=s.replace("playClip(wanted,state.shared?state.playing:true,true)","playClip(wanted,state.playing,true)").replace("  function sample(){\n    body?.resetPose?.();","  function sample(){\n    if(body?.suspendSampling)return;\n    body?.resetPose?.();")
p.write_text(s)
p=root/paths[1];s=p.read_text().replace("externalRetarget=await createQuaterniusRetargeter(library,visible);effects=","body.suspendSampling=true;try{body.resetPose();visible.scene.updateMatrixWorld(true);externalRetarget=await createQuaterniusRetargeter(library,visible);}finally{body.suspendSampling=false;}effects=");p.write_text(s)
assert [blob(p) for p in paths]==expected,[(p,blob(p),e) for p,e in zip(paths,expected)]
print('Materialized exact verified local source',expected)
