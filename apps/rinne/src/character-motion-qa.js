import * as T from 'three';
import { appearanceForCharacter } from '@soul/characters';
import { QA_CAMERAS, QA_CATEGORIES, QA_SEQUENCE, qaCamera, qaSequenceAt, sampleMotionFrames, inspectPose, inspectTransition,
  REVIEW_SWORD_CALIBRATION, createQAReport, serializeQAReport, deserializeQAReport, createCorrectionSampler } from '@soul/animations';
import { createMotionQualityAdapter, hierarchyQuaternion, captureNormalizedMotion } from '@soul/rendering/motion-quality';
import { loadWorkshopMotionSource } from './character-motion-source.js';
const el=id=>document.getElementById(id),storeKey='rinne.motion-qa.v1';
const revision=typeof __BUILD_INFO__==='object'?__BUILD_INFO__.commit:'local';
const download=(data,name)=>{const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
const clone=value=>JSON.parse(JSON.stringify(value));
const maxPenetration=issues=>issues.filter(i=>i.category==='self intersection').reduce((m,i)=>Math.max(m,i.penetration??0),0);

export function createWorkshopMotionQA({review,scene,camera,orbit,canvas,refresh,draw}) {
  if(!el('motion-qa'))return null;
  let bank=null,loading=false,active=false,playing=false,time=0,corrected=true,cameraId='front',tour=false,pose=null,lastUI=-1;
  let speed=1,loopRange=null;
  let report=null,diagnostics=[],observed=[],snapshotPair={before:null,after:null},lastFrame=null,weaponSnapshot=null,comparison=null,compareBusy=false;
  let liveCompare=true,liveBusy=false,liveLast=0,liveFrameId=0;
  const adapters=new WeakMap(),correctionTracks=new WeakMap(),swords=new Map();let swordTemplate;
  const sample=t=>sampleMotionFrames(corrected?{...bank,frames:bank.qualityFrames}:bank,t);
  const notify=text=>{el('qa-status').textContent=text;};
  const conditions=()=>({sequence:'workshop-motion-sequence.v1',fps:60,viewport:[canvas.clientWidth,canvas.clientHeight],dpr:Math.min(devicePixelRatio||1,1.5),lighting:'workshop-pbr.v1',motionRevision:bank?.revision??'unloaded',characters:review.records.slice(0,review.settings.count).map(r=>({record:r,parts:review.actors.find(a=>a.id===r.id)?.appearanceController?.profile??null,identity:review.actors.find(a=>a.id===r.id)?.appearanceController?.identity??null})),secondaryMotion:'off-for-deterministic-QA',correctionRevision:'continuous-clearance.v2',expressionClock:'qa-time',playback:{speed,loopRange},presentation:{view:review.settings.view,count:review.settings.count,selected:review.settings.selected,blink:review.settings.blink,expression:review.settings.expression,expressionMode:review.settings.expressionMode,expressionWeight:review.settings.expressionWeight}});
  function save(){try{localStorage.setItem(storeKey,serializeQAReport(report));}catch{notify('記録の保存に失敗しました。JSONを保存してください。');}}
  function freshReport(){report=createQAReport({build:revision,reviewer:'human',review:conditions()});}
  function adapter(actor){if(!adapters.has(actor))adapters.set(actor,createMotionQualityAdapter(actor,{height:bank.sourceHeight}));return adapters.get(actor);}
  function continuousCorrection(actor,index,qa){
    const appearance=appearanceForCharacter(review.records[index]),controller=actor.appearanceController;
    const key=JSON.stringify([appearance,controller?.profile,controller?.identity]);
    let track=correctionTracks.get(actor);
    if(!track||track.key!==key){
      track={key,sampler:createCorrectionSampler({fps:bank.fps,duration:bank.duration,evaluate:t=>{
        actor.sample(appearance,t,()=>qa.apply(sample(t)));return qa.measureCorrection();
      }})};correctionTracks.set(actor,track);
    }
    const offsets=track.sampler.sample(time);
    actor.sample(appearance,time,()=>qa.apply(pose??sample(time)));
    return qa.applyCorrection(offsets);
  }
  function aim(id=cameraId){cameraId=id;const crowd=review.settings.view==='crowd',actor=review.actors[review.settings.selected];
    const preset=qaCamera(id,{height:2.02,aspect:camera.aspect,center:crowd?[0,0,0]:actor?.root.position.toArray()??[0,0,0],span:crowd?(Math.ceil(Math.sqrt(review.settings.count))-1)*2.1+2.6:0,depth:crowd?(Math.ceil(review.settings.count/Math.ceil(Math.sqrt(review.settings.count)))-1)*2.3+2:0});
    orbit.enableDamping=false;orbit.enabled=false;orbit.update();camera.fov=preset.fov;camera.position.fromArray(preset.position);orbit.target.fromArray(preset.target);camera.lookAt(orbit.target);camera.updateProjectionMatrix();
    for(const b of document.querySelectorAll('[data-qa-camera]'))b.setAttribute('aria-pressed',String(b.dataset.qaCamera===id));draw();
  }
  function sync(){const row=qaSequenceAt(time);el('qa-time').value=String(time);el('qa-motion').value=row.id;el('qa-frame').textContent=`${row.label} · ${time.toFixed(2)}秒 · frame ${row.frame}`;
    el('qa-play').textContent=playing?'Ⅱ 一時停止':'▶ 再生';el('qa-before').textContent=corrected?'単画面: 基盤 ON':'単画面: 基盤 OFF';el('qa-before').setAttribute('aria-pressed',String(corrected));el('qa-before').dataset.mode=corrected?'on':'off';
    const live=el('qa-live-toggle');if(live){live.textContent=liveCompare?'左右比較 ON':'左右比較 OFF';live.setAttribute('aria-pressed',String(liveCompare));}
    el('qa-diagnostics').textContent=diagnostics.length?diagnostics.slice(0,7).map(i=>`${i.severity}: ${i.code??i.category} ${i.affectedBones?.join(' / ')}`).join('\n'):'数値警告なし。見た目の承認は別途必要です。';
    el('qa-record-count').textContent=`記録 ${report?.issues.length??0}件 · Visual Approval: ${report?.visualApproval??'pending'}`;
    if(comparison){const record=review.records[review.settings.selected];const stale=comparison.frame!==row.frame||comparison.camera!==cameraId||comparison.character!==record?.id;el('qa-ab').dataset.stale=String(stale);el('qa-ab-refresh').textContent=stale?'現在フレームでA/B更新':'A/Bを更新';}
  }
  function cleanupWeapons(){for(const [actor,sword]of swords)if(!active||!review.actors.includes(actor)){sword.removeFromParent();swords.delete(actor);}}
  function redrawCurrent(){if(!bank||!active)return;lastFrame=null;pose=sample(time);observed=[];cleanupWeapons();refresh();aim();sync();draw();}
  function setCorrected(next){if(!bank||!active)return;const wasPlaying=playing;corrected=next;redrawCurrent();playing=wasPlaying;sync();}
  async function start(){if(loading)return;loading=true;el('qa-start').disabled=true;notify('既存モーションを準備中…');
    try{if(!bank){bank=await loadWorkshopMotionSource({
      resolveModule:file=>import(/* @vite-ignore */ new URL(`./simulator/src/${file}`,location.href).href),
      readAsset:async(id)=>{const path=id.startsWith('motion:')?`motions/${id.slice(7)}.vrma`:`${id}_review.vrm`;const r=await fetch(new URL(`./simulator/assets/${path}`,location.href),{signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error(`Motion asset HTTP ${r.status}`);return r.arrayBuffer();},
      progress:x=>notify(`既存モーションの準備 ${Math.round(x*100)}%`)});const sourceSword=bank.createSword();swordTemplate=new T.ObjectLoader().parse(sourceSword.toJSON());sourceSword.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();});}
      active=true;playing=true;time=0;speed=1;loopRange=null;el('qa-speed').value='1';el('qa-loop').checked=false;pose=sample(0);lastFrame=null;snapshotPair={before:null,after:null};review.configure({view:'single',rotate:false,paused:false});
      if(!report)freshReport();pose=sample(time);refresh();aim('front');sync();notify('左が基盤OFF、右が基盤ON。同じモーションを同期再生します。');
    }catch(error){active=false;playing=false;notify(`準備できませんでした: ${error.message}`);}finally{loading=false;el('qa-start').disabled=false;}
  }
  function seek(value){if(!bank||!active)return;if(!Number.isFinite(value))throw new Error('Invalid QA seek');time=Math.max(0,Math.min(30,value));if(el('qa-loop').checked){const row=qaSequenceAt(time);loopRange=[row.start,row.end];}playing=false;redrawCurrent();}
  function stop(){active=false;playing=false;cleanupWeapons();orbit.enabled=true;orbit.enableDamping=true;refresh();notify('Motion QAを終了しました。');sync();}
  function capture(){if(!active)return;playing=false;const state=corrected?'after':'before',row=qaSequenceAt(time),record=review.records[review.settings.selected];
    const name=`${record.id}-${row.frame}-${cameraId}-${state}.png`;draw();
    snapshotPair[state]={revision:corrected?revision:`${revision}:quality-off`,evidence:name,timestamp:time,frame:row.frame,camera:cameraId,character:record.id};
    canvas.toBlob(blob=>{if(blob)download(blob,name);},'image/png');sync();notify(`${state==='before'?'補正前':'補正後'}の画像を保存しました。`);
  }
  function recordIssue(){if(!active)return;const row=qaSequenceAt(time),character=review.records[review.settings.selected].id;
    report.issues.push({id:`qa-${report.issues.length+1}`,character,motion:row.source,timestamp:time,frame:row.frame,camera:cameraId,affectedBones:(el('qa-bones').value||'').split(/[ ,]+/).filter(Boolean),severity:el('qa-severity').value,category:el('qa-category').value,note:el('qa-note').value,status:el('qa-issue-status').value,...Object.fromEntries(Object.entries(snapshotPair).map(([k,v])=>[k,v?.frame===row.frame&&v?.camera===cameraId&&v?.character===character?v:null])),conditions:conditions(),diagnostics:diagnostics.slice(0,40)});
    try{serializeQAReport(report);}catch(error){report.issues.pop();notify(error.message);return;}save();sync();notify('このフレームの問題を記録しました。');}
  function finishActor(actor,index,{ui=true}={}){if(!active)return;const qa=adapter(actor);let quality;if(corrected)quality=continuousCorrection(actor,index,qa);else{qa.reset();quality=qa.inspect();}
      let sword=swords.get(actor);if(!sword){sword=swordTemplate.clone(true);swords.set(actor,sword);scene.add(sword);}
      sword.visible=actor.root.visible&&review.records[index].ageMs>=7*60000&&review.records[index].lifeState!=='dead';
      const sample=bank.attachments[Math.min(bank.attachments.length-1,Math.round(time*60))];
      const ageScale=appearanceForCharacter(review.records[index]).scale;
      const frame=time*bank.fps,from=Math.floor(frame),to=Math.min(from+1,bank.attachments.length-1);
      const drawAmount=T.MathUtils.lerp(bank.attachments[from].draw,bank.attachments[to].draw,frame-from);
      const transfer=corrected?qa.matchWeaponTransfer(REVIEW_SWORD_CALIBRATION,bank.socket,drawAmount):{weight:0,error:0};
      let weapon=null;
      if(sample.attachment==='hips'){
        if(corrected)weapon=qa.calibrateCarriedWeapon(sword,REVIEW_SWORD_CALIBRATION,{appearanceScale:ageScale});
        else{
        const hp=actor.root.localToWorld(qa.point('hips').add(new T.Vector3(-.24,.05,-.08).multiplyScalar(bank.sourceHeight/2.02))),q=hierarchyQuaternion(actor.root);
        sword.matrixAutoUpdate=false;sword.matrix.compose(hp,q.multiply(new T.Quaternion().setFromEuler(new T.Euler(-2.10,.08,-.18))),new T.Vector3().setScalar(ageScale*.5)).multiply(new T.Matrix4().makeTranslation(0,.065,0));sword.matrixWorldNeedsUpdate=true;
        }
      }else{
        weapon=qa.calibrateWeapon(sword,corrected?REVIEW_SWORD_CALIBRATION:{...REVIEW_SWORD_CALIBRATION,grip:[0,-.13,0]},bank.socket,{appearanceScale:ageScale});
      }
      quality=qa.inspect(weapon);
      if(ui&&index===review.settings.selected){
        sword.updateWorldMatrix(true,true);weaponSnapshot={attachment:sample.attachment,draw:drawAmount,transferWeight:transfer.weight,transferError:transfer.error,
          grip:actor.root.worldToLocal(new T.Vector3(...REVIEW_SWORD_CALIBRATION.grip).applyMatrix4(sword.matrixWorld)).toArray()};
        const evaluated=captureNormalizedMotion(actor.bones,qa.rest);
        const sanity=inspectPose(evaluated,{mode:'warn',style:'expressive'}).issues;
        const transition=lastFrame&&time>lastFrame.time?inspectTransition(lastFrame.pose,evaluated,time-lastFrame.time):[];
        lastFrame={time,pose:evaluated};diagnostics=[...quality.issues,...sanity,...transition];observed=quality.corrections;sync();
      }
    }
  function comparisonImage(){const width=canvas.width||1,height=canvas.height||1,scale=Math.min(1,720/width),preview=document.createElement('canvas');preview.width=Math.max(1,Math.round(width*scale));preview.height=Math.max(1,Math.round(height*scale));const context=preview.getContext('2d',{alpha:false});if(!context)return canvas.toDataURL('image/jpeg',.88);context.drawImage(canvas,0,0,preview.width,preview.height);return preview.toDataURL('image/jpeg',.88);}
  function comparisonState(state){const row=qaSequenceAt(time),record=review.records[review.settings.selected];return {state,character:record.id,time,frame:row.frame,camera:cameraId,diagnostics:clone(diagnostics.slice(0,40)),corrections:clone(observed.slice(0,40))};}
  function renderComparison(){if(!active||!bank||compareBusy)return comparison;const restorePlaying=playing,restoreTour=tour;compareBusy=true;playing=false;tour=false;el('qa-tour').checked=false;el('qa-ab-refresh').disabled=true;el('qa-ab-known').disabled=true;
    const restore=corrected,take=flag=>{corrected=flag;pose=sample(time);lastFrame=null;observed=[];cleanupWeapons();refresh();draw();return {image:comparisonImage(),meta:comparisonState(flag?'after':'before')};};
    try{const before=take(false),after=take(true),row=qaSequenceAt(time);comparison={character:before.meta.character,time,frame:row.frame,camera:cameraId,before:before.meta,after:after.meta};
      el('qa-ab-before').src=before.image;el('qa-ab-after').src=after.image;el('qa-ab-before').alt=`基盤OFF ${before.meta.character} frame ${row.frame} ${cameraId}`;el('qa-ab-after').alt=`基盤ON ${after.meta.character} frame ${row.frame} ${cameraId}`;
      el('qa-ab-before-link').href=before.image;el('qa-ab-after-link').href=after.image;el('qa-ab-before-link').download=`motion-qa-${row.frame}-${cameraId}-basis-off.jpg`;el('qa-ab-after-link').download=`motion-qa-${row.frame}-${cameraId}-basis-on.jpg`;
      const beforePen=maxPenetration(before.meta.diagnostics),afterPen=maxPenetration(after.meta.diagnostics),corrections=after.meta.corrections.map(c=>c.method).filter(Boolean);
      el('qa-ab-meta').textContent=`${before.meta.character} · ${time.toFixed(3)}秒 · frame ${row.frame} · ${cameraId}`;
      el('qa-ab-summary').textContent=`自己交差の最大侵入量 A ${beforePen.toFixed(4)} → B ${afterPen.toFixed(4)}\n数値警告 A ${before.meta.diagnostics.length}件 / B ${after.meta.diagnostics.length}件\nBで適用: ${[...new Set(corrections)].join(' / ')||'記録なし'}\n数値は補助情報です。合否は左右の実画像を見て判断してください。`;
      el('qa-ab').dataset.stale='false';notify('同一フレーム・同一カメラのA/B比較を更新しました。');return comparison;
    }finally{corrected=restore;pose=sample(time);lastFrame=null;observed=[];cleanupWeapons();refresh();draw();playing=restorePlaying;tour=restoreTour;el('qa-tour').checked=tour;sync();compareBusy=false;el('qa-ab-refresh').disabled=false;el('qa-ab-known').disabled=false;}
  }
  async function compareCurrent(){if(!active)await start();if(active)renderComparison();}
  async function compareKnown(){if(!active)await start();if(!active)return;seek(17.475);aim('front-left');renderComparison();}
  function streamlineUI(){const root=el('motion-qa'),heading=root.querySelector('h2'),quick=el('qa-start').parentElement,step=el('qa-prev').parentElement,diagnostic=root.querySelector('details'),tourLabel=el('qa-tour').closest('label'),countRow=root.querySelector('[data-qa-count]')?.parentElement,motionLabel=el('qa-motion').parentElement;
    if(heading)heading.textContent='モーション比較';if(el('tab-qa'))el('tab-qa').textContent='動き比較';el('qa-start').textContent='▶ 30秒を開始';el('qa-stop').textContent='終了';quick.classList.add('qa-quickbar');step.classList.add('qa-stepbar');if(motionLabel?.firstChild)motionLabel.firstChild.textContent='区間へ移動';
    const live=document.createElement('button');live.id='qa-live-toggle';live.type='button';live.textContent='左右比較 ON';live.setAttribute('aria-pressed','true');quick.append(live);
    const cameraTitle=document.createElement('h3');cameraTitle.className='qa-section-title';cameraTitle.textContent='カメラ';el('qa-cameras').before(cameraTitle);
    const more=document.createElement('details');more.className='qa-more';const summary=document.createElement('summary');summary.textContent='表示オプション';more.append(summary,el('qa-before'));if(tourLabel)more.append(tourLabel);if(countRow)more.append(countRow);el('qa-cameras').after(more);
    if(diagnostic){diagnostic.classList.add('qa-diagnostics-panel');diagnostic.querySelector('summary').textContent='診断・記録';diagnostic.append(el('qa-record-count'));const io=el('qa-export').parentElement;if(io)diagnostic.append(io);}
    live.onclick=()=>{liveCompare=!liveCompare;sync();if(liveCompare)renderLivePair(performance.now(),true);};
  }
  streamlineUI();
  const style=document.createElement('style');style.dataset.motionQaAb='true';style.textContent=`#motion-qa>h2{font-size:1rem;margin-bottom:.3rem}#qa-status{margin:.2rem 0 .55rem;color:#b9c9c8}.qa-quickbar{position:sticky;top:-9px;z-index:4;display:grid!important;grid-template-columns:1.05fr 1.05fr .7fr;gap:6px;padding:8px 0 9px;background:linear-gradient(#18272c 78%,rgba(24,39,44,0));backdrop-filter:blur(5px)}.qa-quickbar #qa-start{grid-column:1/-1;min-height:46px}.qa-quickbar #qa-play,.qa-quickbar #qa-live-toggle,.qa-quickbar #qa-stop{min-height:44px}.qa-quickbar #qa-live-toggle{font-weight:750;border-color:#d8be83;background:#39382e;color:#ffecc1}.qa-stepbar{display:grid!important;grid-template-columns:1fr 1fr;gap:6px;margin:.35rem 0}.qa-section-title{margin:.7rem 0 .3rem!important}.qa-more,.qa-diagnostics-panel{margin:.65rem 0;border-top:1px solid rgba(255,255,255,.08);padding-top:.25rem}.qa-more summary,.qa-diagnostics-panel summary{min-height:42px;padding:9px 2px;cursor:pointer;color:#d7ddd8}.qa-more #qa-before{width:100%;margin:.25rem 0}.qa-more #qa-before[data-mode="on"]{border-color:#d8be83}.qa-more #qa-before[data-mode="off"]{border-color:#d98f75}#qa-ab{margin:.65rem 0;padding:.6rem;border:1px solid rgba(220,196,147,.28);border-radius:9px;background:rgba(10,20,23,.35)}#qa-ab .qa-ab-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;flex-wrap:wrap}#qa-ab .qa-ab-head h3{margin:0;color:#efe4c8;font-size:.8rem}#qa-ab .qa-ab-actions{display:flex;gap:.4rem;flex-wrap:wrap}#qa-ab .qa-ab-meta{display:block;margin:.4rem 0;font-size:.7rem;opacity:.82}#qa-ab[data-stale="true"] .qa-ab-meta::after{content:' · 現在の条件と異なります';color:#efcf8f}#qa-ab .qa-ab-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.4rem}#qa-ab figure{min-width:0;margin:0;border:1px solid rgba(255,255,255,.12);border-radius:7px;overflow:hidden;background:#0b1316}#qa-ab figcaption{padding:.35rem .4rem;font-size:.72rem;font-weight:700}#qa-ab img{display:block;width:100%;min-height:90px;max-height:220px;object-fit:contain;background:#081013}#qa-ab figure a{display:block;padding:.3rem .4rem;font-size:.68rem}#qa-ab-summary{margin:.45rem 0 0;white-space:pre-wrap;font-size:.7rem;line-height:1.4}#motion-live-compare{position:absolute;inset:0;z-index:6;display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#080d0f;pointer-events:none}#motion-live-compare[hidden]{display:none}#motion-live-compare .live-pane{position:relative;min-width:0;overflow:hidden;background:#111a1d}#motion-live-compare canvas{display:block;width:100%;height:100%}#motion-live-compare .live-label{position:absolute;z-index:2;top:8px;left:8px;padding:5px 8px;border-radius:999px;background:#0b1115dd;border:1px solid #ffffff22;font-size:10px;font-weight:800;letter-spacing:.05em}#motion-live-compare .live-pane:first-child .live-label{color:#ffc9b8;border-color:#d98f7566}#motion-live-compare .live-pane:last-child .live-label{color:#dff0bd;border-color:#9ab66a66}#motion-live-compare .live-time{position:absolute;z-index:3;left:50%;bottom:8px;transform:translateX(-50%);padding:4px 7px;border-radius:6px;background:#071014d9;color:#d8e0de;font-size:9px;white-space:nowrap}@media(max-width:420px){.qa-quickbar{grid-template-columns:1fr 1fr .62fr}.qa-quickbar button{padding-left:5px;padding-right:5px;font-size:.72rem}#motion-live-compare .live-label{top:6px;left:6px;padding:4px 6px;font-size:9px}}`;document.head.append(style);
  const ab=document.createElement('section');ab.id='qa-ab';ab.dataset.stale='false';const abHead=document.createElement('div');abHead.className='qa-ab-head';const abTitle=document.createElement('h3');abTitle.textContent='静止画A/B';const abActions=document.createElement('div');abActions.className='qa-ab-actions';const abKnown=document.createElement('button');abKnown.id='qa-ab-known';abKnown.type='button';abKnown.textContent='既知差 17.475秒';const abRefresh=document.createElement('button');abRefresh.id='qa-ab-refresh';abRefresh.type='button';abRefresh.textContent='今の位置で保存';abActions.append(abKnown,abRefresh);abHead.append(abTitle,abActions);const abMeta=document.createElement('output');abMeta.id='qa-ab-meta';abMeta.className='qa-ab-meta';abMeta.textContent='必要なときだけ静止画でも比較できます。';const abGrid=document.createElement('div');abGrid.className='qa-ab-grid';
  const makeFigure=(id,label,downloadLabel)=>{const figure=document.createElement('figure'),caption=document.createElement('figcaption'),image=document.createElement('img'),link=document.createElement('a');caption.textContent=label;image.id=`qa-ab-${id}`;image.alt=`${label}の比較画像は未取得です`;link.id=`qa-ab-${id}-link`;link.textContent=downloadLabel;link.href='#';link.addEventListener('click',event=>{if(!link.href.startsWith('data:image/'))event.preventDefault();});figure.append(caption,image,link);return figure;};
  abGrid.append(makeFigure('before','A · 基盤OFF','A画像を保存'),makeFigure('after','B · 基盤ON','B画像を保存'));const abSummary=document.createElement('pre');abSummary.id='qa-ab-summary';abSummary.textContent='自己交差・対象ボーン・適用補正を補助表示します。数値だけで合格にはしません。';ab.append(abHead,abMeta,abGrid,abSummary);el('motion-qa').querySelector('.qa-more').append(ab);abKnown.onclick=()=>void compareKnown();abRefresh.onclick=()=>void compareCurrent();
  const liveLayer=document.createElement('div');liveLayer.id='motion-live-compare';liveLayer.hidden=true;const panes=['OFF','ON'].map(label=>{const pane=document.createElement('div');pane.className='live-pane';const c=document.createElement('canvas');c.setAttribute('aria-label',`基盤${label}の同期映像`);const tag=document.createElement('span');tag.className='live-label';tag.textContent=`基盤 ${label}`;pane.append(c,tag);liveLayer.append(pane);return c;});const liveTime=document.createElement('output');liveTime.className='live-time';liveLayer.append(liveTime);canvas.parentElement.append(liveLayer);
  function copyLive(target){const sw=canvas.width||1,sh=canvas.height||1,tw=Math.max(1,Math.floor(sw/2));if(target.width!==tw)target.width=tw;if(target.height!==sh)target.height=sh;const ctx=target.getContext('2d',{alpha:false});const crop=Math.min(sw,tw),sx=Math.max(0,(sw-crop)/2);ctx.drawImage(canvas,sx,0,crop,sh,0,0,tw,sh);}
  function renderLiveState(flag){corrected=flag;pose=sample(time);lastFrame=null;cleanupWeapons();for(let i=0;i<review.actors.length;i++){const actor=review.actors[i],record=review.records[i];if(!record)continue;actor.sample(appearanceForCharacter(record),time+i*.19,()=>adapter(actor).apply(pose));finishActor(actor,i,{ui:false});}draw();}
  function renderLivePair(now=performance.now(),force=false){const qaVisible=el('tab-qa')?.getAttribute('aria-selected')==='true';if(!active||!bank||!liveCompare||!qaVisible){liveLayer.hidden=true;return;}const interval=playing?1000/30:100;if(!force&&now-liveLast<interval)return;if(liveBusy)return;liveBusy=true;liveLast=now;const restore=corrected;try{liveLayer.hidden=false;renderLiveState(false);copyLive(panes[0]);renderLiveState(true);copyLive(panes[1]);const row=qaSequenceAt(time);liveTime.value=`${row.label} · ${time.toFixed(2)}秒 · frame ${row.frame}`;}finally{corrected=restore;pose=sample(time);liveBusy=false;}}
  function liveLoop(now){renderLivePair(now);liveFrameId=requestAnimationFrame(liveLoop);}liveFrameId=requestAnimationFrame(liveLoop);
  for(const id of Object.keys(QA_CAMERAS)){const b=document.createElement('button');b.type='button';b.dataset.qaCamera=id;b.textContent={front:'正面',left:'左',right:'右',back:'背面','front-left':'左前','front-right':'右前','back-left':'左後','back-right':'右後'}[id];b.onclick=()=>{if(active){tour=false;el('qa-tour').checked=false;aim(id);renderLivePair(performance.now(),true);sync();}};el('qa-cameras').append(b);}
  for(const category of QA_CATEGORIES)el('qa-category').add(new Option(category,category));
  for(const row of QA_SEQUENCE)el('qa-motion').add(new Option(`${row.label} · ${row.source}`,row.id));
  el('qa-start').onclick=()=>void start();el('qa-stop').onclick=stop;
  el('qa-play').onclick=()=>{if(!active)return;if(time>=30)seek(loopRange?.[0]??0);playing=!playing;review.configure({paused:false});sync();};
  el('qa-before').onclick=()=>setCorrected(!corrected);el('qa-time').oninput=e=>seek(Number(e.target.value));
  el('qa-prev').onclick=()=>seek(time-1/60);el('qa-next').onclick=()=>seek(time+1/60);
  el('qa-motion').onchange=e=>seek(QA_SEQUENCE.find(r=>r.id===e.target.value).start);
  el('qa-speed').onchange=e=>speed=Number(e.target.value);
  el('qa-loop').onchange=e=>{const row=qaSequenceAt(time);loopRange=e.target.checked?[row.start,row.end]:null;};
  el('qa-tour').onchange=e=>tour=e.target.checked;el('qa-capture').onclick=capture;el('qa-record').onclick=recordIssue;
  el('qa-export').onclick=()=>{if(!report)freshReport();download(new Blob([serializeQAReport(report)],{type:'application/json'}),'character-motion-qa.json');};
  el('qa-import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1_000_000)throw new Error('QA report too large');const next=deserializeQAReport(await file.text());report=next;save();sync();notify('QAレポートを読み込みました。');}catch(error){notify(`読込失敗: ${error.message}`);}finally{e.target.value='';}};
  for(const button of document.querySelectorAll('[data-qa-count]'))button.onclick=()=>{const count=Number(button.dataset.qaCount);review.configure(count===1?{view:'single'}:{view:'crowd',count});if(active){aim();renderLivePair(performance.now(),true);}};
  try{const saved=localStorage.getItem(storeKey);if(saved)report=deserializeQAReport(saved);}catch{notify('保存済みQAレポートを読み込めませんでした。');}
  sync();
  const api={
    get active(){return active;},get playing(){return playing;},get time(){return time;},get ready(){return !!bank;},get corrected(){return corrected;},get liveCompare(){return liveCompare;},get camera(){return cameraId;},get diagnostics(){return diagnostics;},get sources(){return bank?.sources??[];},
    get comparison(){return comparison?clone(comparison):null;},get report(){return report?JSON.parse(serializeQAReport(report)):null;},start,stop,seek,aim,renderComparison,
    tick(dt){if(!active)return;cleanupWeapons();if(playing&&!review.settings.paused){time+=dt*speed;if(loopRange&&time>=loopRange[1])time=loopRange[0]+(time-loopRange[1])%(loopRange[1]-loopRange[0]);else if(time>=30){time=30;playing=false;}}
      pose=sample(time);if(tour){const id=Object.keys(QA_CAMERAS)[Math.min(7,Math.floor(time/3.75))];if(id!==cameraId)aim(id);}
      observed=[];if(lastUI<0||Math.abs(time-lastUI)>.1){sync();lastUI=time;}
    },
    pose(actor){return active?()=>adapter(actor).apply(pose??sample(time)):null;},
    finish(actor,index){finishActor(actor,index);},
    snapshot(){return {time,playing,frame:qaSequenceAt(time).frame,camera:cameraId,cameraPosition:camera.position.toArray(),cameraTarget:orbit.target.toArray(),corrected,liveCompare,diagnostics,corrections:observed,weapon:weaponSnapshot,playback:{speed,loopRange},comparison:comparison?clone(comparison):null,visualRequired:['skinning / weight','clothing','hair','silhouette'],conditions:conditions()};},
    dispose(){active=false;cancelAnimationFrame(liveFrameId);liveLayer.remove();cleanupWeapons();style.remove();swordTemplate?.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();});}
  };
  return api;
}
