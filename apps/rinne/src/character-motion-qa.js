import * as T from 'three';
import { appearanceForCharacter } from '@soul/characters';
import { QA_CAMERAS, QA_CATEGORIES, QA_SEQUENCE, qaCamera, qaSequenceAt, sampleMotionFrames, inspectPose, inspectTransition,
  REVIEW_SWORD_CALIBRATION, createQAReport, serializeQAReport, deserializeQAReport } from '@soul/animations';
import { createMotionQualityAdapter, hierarchyQuaternion, captureNormalizedMotion } from '@soul/rendering/motion-quality';
import { loadWorkshopMotionSource } from './character-motion-source.js';
const el=id=>document.getElementById(id),storeKey='rinne.motion-qa.v1';
const revision=typeof __BUILD_INFO__==='object'?__BUILD_INFO__.commit:'local';
const download=(data,name)=>{const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

export function createWorkshopMotionQA({review,scene,camera,orbit,canvas,refresh,draw}) {
  if(!el('motion-qa'))return null;
  let bank=null,loading=false,active=false,playing=false,time=0,corrected=true,cameraId='front',tour=false,pose=null,lastUI=-1;
  let report=null,diagnostics=[],observed=[],snapshotPair={before:null,after:null},lastFrame=null;
  const adapters=new WeakMap(),swords=new Map();let swordTemplate;
  const sample=t=>sampleMotionFrames(corrected?{...bank,frames:bank.qualityFrames}:bank,t);
  const notify=text=>{el('qa-status').textContent=text;};
  const conditions=()=>({sequence:'workshop-motion-sequence.v1',fps:60,viewport:[canvas.clientWidth,canvas.clientHeight],dpr:Math.min(devicePixelRatio||1,1.5),lighting:'workshop-pbr.v1',motionRevision:bank?.revision??'unloaded',characters:review.records.slice(0,review.settings.count).map(r=>({record:r,parts:review.actors.find(a=>a.id===r.id)?.appearanceController?.profile??null,identity:review.actors.find(a=>a.id===r.id)?.appearanceController?.identity??null})),secondaryMotion:'off-for-deterministic-QA'});
  function save(){try{localStorage.setItem(storeKey,serializeQAReport(report));}catch{notify('記録の保存に失敗しました。JSONを保存してください。');}}
  function freshReport(){report=createQAReport({build:revision,reviewer:'human',review:conditions()});}
  function adapter(actor){if(!adapters.has(actor))adapters.set(actor,createMotionQualityAdapter(actor,{height:bank.sourceHeight}));return adapters.get(actor);}
  function aim(id=cameraId){cameraId=id;const crowd=review.settings.view==='crowd',actor=review.actors[review.settings.selected];
    const preset=qaCamera(id,{height:2.02,aspect:camera.aspect,center:crowd?[0,0,0]:actor?.root.position.toArray()??[0,0,0],span:crowd?(Math.ceil(Math.sqrt(review.settings.count))-1)*2.1+2.6:0,depth:crowd?(Math.ceil(review.settings.count/Math.ceil(Math.sqrt(review.settings.count)))-1)*2.3+2:0});
    orbit.enableDamping=false;orbit.enabled=false;orbit.update();camera.fov=preset.fov;camera.position.fromArray(preset.position);orbit.target.fromArray(preset.target);camera.lookAt(orbit.target);camera.updateProjectionMatrix();
    for(const b of document.querySelectorAll('[data-qa-camera]'))b.setAttribute('aria-pressed',String(b.dataset.qaCamera===id));draw();
  }
  function sync(){const row=qaSequenceAt(time);el('qa-time').value=String(time);el('qa-motion').value=row.id;el('qa-frame').textContent=`${row.label} · ${time.toFixed(2)}秒 / frame ${row.frame} · ${corrected?'補正後':'補正前'}`;
    el('qa-play').textContent=playing?'一時停止':'再開';el('qa-before').textContent=corrected?'補正前を見る':'補正後を見る';el('qa-before').setAttribute('aria-pressed',String(!corrected));
    el('qa-diagnostics').textContent=diagnostics.length?diagnostics.slice(0,7).map(i=>`${i.severity}: ${i.code??i.category} ${i.affectedBones?.join(' / ')}`).join('\n'):'数値警告なし。見た目の承認は別途必要です。';
    el('qa-record-count').textContent=`記録 ${report?.issues.length??0}件 · Visual Approval: ${report?.visualApproval??'pending'}`;
  }
  function cleanupWeapons(){for(const [actor,sword]of swords)if(!active||!review.actors.includes(actor)){sword.removeFromParent();swords.delete(actor);}}
  async function start(){if(loading)return;loading=true;el('qa-start').disabled=true;notify('既存モーションを準備中…');
    try{if(!bank){bank=await loadWorkshopMotionSource({
      resolveModule:file=>import(/* @vite-ignore */ new URL(`./simulator/src/${file}`,location.href).href),
      readAsset:async(id)=>{const path=id.startsWith('motion:')?`motions/${id.slice(7)}.vrma`:`${id}_review.vrm`;const r=await fetch(new URL(`./simulator/assets/${path}`,location.href),{signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error(`Motion asset HTTP ${r.status}`);return r.arrayBuffer();},
      progress:x=>notify(`既存モーションの準備 ${Math.round(x*100)}%`)});const sourceSword=bank.createSword();swordTemplate=new T.ObjectLoader().parse(sourceSword.toJSON());sourceSword.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();});}
      active=true;playing=true;time=0;pose=sample(0);lastFrame=null;snapshotPair={before:null,after:null};review.configure({rotate:false,paused:false});
      if(!report)freshReport();pose=sample(time);refresh();aim('front');sync();notify('30秒のMotion QA。8方向・コマ送り・補正前後を確認できます。');
    }catch(error){active=false;playing=false;notify(`準備できませんでした: ${error.message}`);}finally{loading=false;el('qa-start').disabled=false;}
  }
  function seek(value){if(!bank||!active)return;time=Math.max(0,Math.min(30,value));playing=false;lastFrame=null;pose=sample(time);cleanupWeapons();refresh();aim();sync();draw();}
  function stop(){active=false;playing=false;cleanupWeapons();orbit.enabled=true;orbit.enableDamping=true;refresh();notify('Motion QAを終了しました。');}
  function capture(){if(!active)return;playing=false;const state=corrected?'after':'before',row=qaSequenceAt(time),record=review.records[review.settings.selected];
    const name=`${record.id}-${row.frame}-${cameraId}-${state}.png`;draw();
    snapshotPair[state]={revision:corrected?revision:`${revision}:quality-off`,evidence:name,timestamp:time,frame:row.frame,camera:cameraId,character:record.id};
    canvas.toBlob(blob=>{if(blob)download(blob,name);},'image/png');sync();notify(`${state==='before'?'補正前':'補正後'}の画像を保存しました。`);
  }
  function recordIssue(){if(!active)return;const row=qaSequenceAt(time),character=review.records[review.settings.selected].id;
    report.issues.push({id:`qa-${report.issues.length+1}`,character,motion:row.source,timestamp:time,frame:row.frame,camera:cameraId,affectedBones:(el('qa-bones').value||'').split(/[ ,]+/).filter(Boolean),severity:el('qa-severity').value,category:el('qa-category').value,note:el('qa-note').value,status:el('qa-issue-status').value,...Object.fromEntries(Object.entries(snapshotPair).map(([k,v])=>[k,v?.frame===row.frame&&v?.camera===cameraId&&v?.character===character?v:null])),conditions:conditions(),diagnostics:diagnostics.slice(0,40)});
    try{serializeQAReport(report);}catch(error){report.issues.pop();notify(error.message);return;}save();sync();notify('このフレームの問題を記録しました。');}
  for(const id of Object.keys(QA_CAMERAS)){const b=document.createElement('button');b.type='button';b.dataset.qaCamera=id;b.textContent={front:'正面',left:'左',right:'右',back:'背面','front-left':'左前','front-right':'右前','back-left':'左後','back-right':'右後'}[id];b.onclick=()=>{if(active){tour=false;el('qa-tour').checked=false;aim(id);sync();}};el('qa-cameras').append(b);}
  for(const category of QA_CATEGORIES)el('qa-category').add(new Option(category,category));
  for(const row of QA_SEQUENCE)el('qa-motion').add(new Option(`${row.label} · ${row.source}`,row.id));
  el('qa-start').onclick=()=>void start();el('qa-stop').onclick=stop;
  el('qa-play').onclick=()=>{if(!active)return;if(time>=30)seek(0);playing=!playing;review.configure({paused:false});sync();};
  el('qa-before').onclick=()=>{corrected=!corrected;seek(time);};el('qa-time').oninput=e=>seek(Number(e.target.value));
  el('qa-prev').onclick=()=>seek(time-1/60);el('qa-next').onclick=()=>seek(time+1/60);
  el('qa-motion').onchange=e=>seek(QA_SEQUENCE.find(r=>r.id===e.target.value).start);
  el('qa-tour').onchange=e=>tour=e.target.checked;el('qa-capture').onclick=capture;el('qa-record').onclick=recordIssue;
  el('qa-export').onclick=()=>{if(!report)freshReport();download(new Blob([serializeQAReport(report)],{type:'application/json'}),'character-motion-qa.json');};
  el('qa-import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1_000_000)throw new Error('QA report too large');const next=deserializeQAReport(await file.text());report=next;save();sync();notify('QAレポートを読み込みました。');}catch(error){notify(`読込失敗: ${error.message}`);}finally{e.target.value='';}};
  for(const button of document.querySelectorAll('[data-qa-count]'))button.onclick=()=>{const count=Number(button.dataset.qaCount);review.configure(count===1?{view:'single'}:{view:'crowd',count});if(active)aim();};
  try{const saved=localStorage.getItem(storeKey);if(saved)report=deserializeQAReport(saved);}catch{notify('保存済みQAレポートを読み込めませんでした。');}
  const api={
    get active(){return active;},get playing(){return playing;},get time(){return time;},get ready(){return !!bank;},get corrected(){return corrected;},get camera(){return cameraId;},get diagnostics(){return diagnostics;},get sources(){return bank?.sources??[];},
    get report(){return report?JSON.parse(serializeQAReport(report)):null;},start,stop,seek,aim,
    tick(dt){if(!active)return;cleanupWeapons();if(playing&&!review.settings.paused){time=Math.min(30,time+dt);if(time>=30)playing=false;}
      pose=sample(time);if(tour){const id=Object.keys(QA_CAMERAS)[Math.min(7,Math.floor(time/3.75))];if(id!==cameraId)aim(id);}
      observed=[];if(lastUI<0||Math.abs(time-lastUI)>.1){sync();lastUI=time;}
    },
    pose(actor){return active?()=>adapter(actor).apply(pose??sample(time)):null;},
    finish(actor,index){if(!active)return;const qa=adapter(actor);let quality=corrected?qa.correct():qa.inspect();
      let sword=swords.get(actor);if(!sword){sword=swordTemplate.clone(true);swords.set(actor,sword);scene.add(sword);}
      sword.visible=actor.root.visible&&review.records[index].ageMs>=7*60000&&review.records[index].lifeState!=='dead';
      const sample=bank.attachments[Math.min(bank.attachments.length-1,Math.round(time*60))];
      const ageScale=appearanceForCharacter(review.records[index]).scale;
      if(sample.attachment==='hips'){
        const hp=actor.root.localToWorld(qa.point('hips').add(new T.Vector3(-.24,.05,-.08).multiplyScalar(bank.sourceHeight/2.02))),q=hierarchyQuaternion(actor.root);
        sword.matrixAutoUpdate=false;sword.matrix.compose(hp,q.multiply(new T.Quaternion().setFromEuler(new T.Euler(-2.10,.08,-.18))),new T.Vector3().setScalar(ageScale*.5)).multiply(new T.Matrix4().makeTranslation(0,.065,0));sword.matrixWorldNeedsUpdate=true;
      }else{
        const weapon=qa.calibrateWeapon(sword,corrected?REVIEW_SWORD_CALIBRATION:{...REVIEW_SWORD_CALIBRATION,grip:[0,-.13,0]},bank.socket,{appearanceScale:ageScale});quality=qa.inspect(weapon);
      }
      if(index===review.settings.selected){
        const evaluated=captureNormalizedMotion(actor.bones,qa.rest);
        const sanity=inspectPose(evaluated,{mode:'warn',style:'expressive'}).issues;
        const transition=lastFrame&&time>lastFrame.time?inspectTransition(lastFrame.pose,evaluated,time-lastFrame.time):[];
        lastFrame={time,pose:evaluated};diagnostics=[...quality.issues,...sanity,...transition];observed=quality.corrections;sync();
      }
    },
    snapshot(){return {time,frame:qaSequenceAt(time).frame,camera:cameraId,cameraPosition:camera.position.toArray(),cameraTarget:orbit.target.toArray(),corrected,diagnostics,corrections:observed,visualRequired:['skinning / weight','clothing','hair','silhouette'],conditions:conditions()};},
    dispose(){active=false;cleanupWeapons();swordTemplate?.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();});}
  };
  return api;
}
