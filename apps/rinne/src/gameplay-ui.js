import { ARMOR_LABELS, WEAPON_LABELS, ensureProgression } from './gameplay-world.js';
import { createConversationInput } from './rebuild/conversation-input.js';
import { createSkillSetter } from './skill-setter.js';
import { createHeartTechniqueBodyUI } from './heart-technique-body-ui.js';
import './rebuild/conversation-input.css';
import './skill-setter.css';
import './heart-technique-body.css';

export function createGameplayUI(gameScreen,{stations,layout,audio}){
  const root=document.createElement('div');
  root.className='rinne-gameplay-upgrade';
  root.innerHTML=`
    <div class="rinne-player-strip"><span data-name>旅人</span><i></i><span data-equip>素手 · 旅装</span><span data-state>探索</span></div>
    <nav class="rinne-bottom-controls" aria-label="プレイ操作">
      <button data-heart class="upgrade-control is-heart"><span>心</span><small>心得</small><em data-heart-badge hidden>0</em></button>
      <button data-techniques class="upgrade-control is-technique"><span>技</span><small>技</small><em data-tech-badge hidden>0</em></button>
      <button data-body class="upgrade-control is-body"><span>体</span><small>構え</small></button>
      <button data-items class="upgrade-control"><span>具</span><small>所持品</small></button>
      <button data-debug class="upgrade-control is-debug"><span>時</span><small>DEBUG</small></button>
    </nav>
    <button data-one-motion class="one-motion-control" type="button" hidden>
      <b>瞬</b><span><strong data-one-motion-name>ワンモーション</strong><small>タップ発動 · 消耗大 / 隙大</small></span>
    </button>
    <section data-panel class="upgrade-panel" hidden>
      <header><i class="upgrade-sheet-grip" aria-hidden="true"></i><strong data-title></strong><button data-close aria-label="閉じる">×</button></header>
      <div data-body></div>
    </section>
    <aside data-spark class="technique-spark" role="status" aria-live="polite" hidden>
      <div><span>閃き</span><strong data-spark-name></strong><small>長押しで詳細を確認できる</small></div>
      <button data-spark-set type="button">確認</button>
    </aside>
    <div data-rest class="upgrade-rest" hidden><span></span><strong>休憩中</strong><small>長押し中、息を整えている</small></div>
    <div data-training class="upgrade-training" hidden><strong>稽古態勢</strong><span data-training-name>かかし</span></div>`;
  gameScreen.append(root);

  // Dash stays an internal runtime input. The mobile HUD deliberately has no dedicated run key.
  const dash=document.createElement('button');dash.type='button';dash.hidden=true;
  const q=s=>root.querySelector(s),ui={
    root,dash,heart:q('[data-heart]'),heartBadge:q('[data-heart-badge]'),techniques:q('[data-techniques]'),techBadge:q('[data-tech-badge]'),bodyButton:q('[data-body]'),items:q('[data-items]'),debug:q('[data-debug]'),
    oneMotion:q('[data-one-motion]'),oneMotionName:q('[data-one-motion-name]'),panel:q('[data-panel]'),title:q('[data-title]'),body:q('[data-body]'),close:q('[data-close]'),spark:q('[data-spark]'),sparkName:q('[data-spark-name]'),sparkSet:q('[data-spark-set]'),
    rest:q('[data-rest]'),training:q('[data-training]'),trainingName:q('[data-training-name]'),name:q('[data-name]'),equip:q('[data-equip]'),state:q('[data-state]')
  };
  let state=null,sheetDrag=null,movementHelpTimer=0;
  const speech=createConversationInput({document,window,root:gameScreen,getState:()=>state});
  const tracker=createSkillSetter({ui,audio,getState:()=>state});
  const loadoutUI=createHeartTechniqueBodyUI({ui,audio,getState:()=>state,tracker});
  const moveHint=gameScreen.querySelector('#move-hint');
  const showMovementHelp=event=>{
    event.stopImmediatePropagation();
    const node=document.getElementById('toast');if(!node)return;
    node.textContent=moveHint?.textContent?.includes('母')?'抱っこ中も画面をスワイプすると、母に抱かれたまま村を見て回れます。':'スワイプで移動。素早いスワイプで疾走し、画面長押しで休憩して息を回復します。';
    node.hidden=false;clearTimeout(movementHelpTimer);movementHelpTimer=setTimeout(()=>{node.hidden=true;},3200);
  };
  moveHint?.addEventListener('click',showMovementHelp,{capture:true});

  function inventory(){
    ensureProgression(state);ui.title.textContent='具';ui.body.innerHTML='<div class="loadout-section-title"><i></i><strong>所持品</strong><i></i></div>';
    const group=(title,items,active,set,label)=>{const section=document.createElement('section');section.className='inventory-group';section.innerHTML=`<h3>${title}</h3>`;const list=document.createElement('div');list.className='inventory-list';for(const item of items){const button=document.createElement('button');button.dataset.active=String(item===active);button.textContent=label(item);button.onclick=()=>{set(item);audio.item();inventory();};list.append(button);}section.append(list);ui.body.append(section);};
    group('武器',state.inventory.weapons,state.equipment.weapon,value=>state.equipment.weapon=value,value=>WEAPON_LABELS[value]||value);
    group('防具',state.inventory.armors,state.equipment.armor,value=>state.equipment.armor=value,value=>ARMOR_LABELS[value]||value);
    group('盾',state.inventory.shields,Boolean(state.equipment.shield),value=>state.equipment.shield=Boolean(value),value=>value?'盾あり':'盾なし');
  }
  function markOpenControl(type){ui.heart.dataset.active=String(type==='heart');ui.techniques.dataset.active=String(type==='technique');ui.bodyButton.dataset.active=String(type==='body');ui.items.dataset.active=String(type==='items');}
  function open(type,{skillId=null,silent=false,keepScroll=false}={}){
    if(!state||type==='map')return;const oldScroll=keepScroll?ui.panel.scrollTop:0;ui.panel.hidden=false;ui.panel.dataset.type=type;markOpenControl(type);
    if(type==='heart')loadoutUI.renderHeart(skillId);else if(type==='technique')loadoutUI.renderTechnique(skillId);else if(type==='body')loadoutUI.renderBody();else inventory();
    if(keepScroll)requestAnimationFrame(()=>{ui.panel.scrollTop=oldScroll;});if(!silent)audio.ui();
  }
  function close(){ui.panel.hidden=true;delete ui.panel.dataset.type;ui.panel.style.removeProperty('--loadout-sheet-drag');delete ui.panel.dataset.dragging;ui.panel.querySelector('.loadout-detail-popover')?.remove();markOpenControl('');audio.ui();}
  function bindState(next){state=next;const lifeChanged=tracker.bindState(next);if(lifeChanged){loadoutUI.reset();if(!ui.panel.hidden){ui.panel.hidden=true;delete ui.panel.dataset.type;markOpenControl('');}}}
  function refresh(){if(ui.panel.hidden||!state)return;open(ui.panel.dataset.type||'items',{silent:true,keepScroll:true});}
  function summary(s,{dashing=false,resting=false,training=null}={}){
    state=s;speech.sync();loadoutUI.syncCombat(s);ui.name.textContent=`${s.name||'旅人'} · ${Math.floor(s.ageYears||0)}歳`;ui.equip.textContent=`${WEAPON_LABELS[s.equipment?.weapon]||'素手'} · ${ARMOR_LABELS[s.equipment?.armor]||'旅装'}`;
    ui.state.textContent=s.down?'行動不能':resting?'休憩':dashing?'疾走':s.combat||training?.d<2.8?'戦闘態勢':'探索';ui.rest.hidden=!resting;ui.dash.dataset.active=String(dashing);const engaged=training?.d<2.8;ui.training.hidden=!engaged;if(engaged)ui.trainingName.textContent=training.label;
  }
  function bindSheetGesture(){
    const header=ui.panel.querySelector('header');header.addEventListener('pointerdown',event=>{if(!['heart','technique','body'].includes(ui.panel.dataset.type)||event.target.closest('button'))return;sheetDrag={id:event.pointerId,startY:event.clientY,dy:0};header.setPointerCapture?.(event.pointerId);ui.panel.dataset.dragging='true';});
    header.addEventListener('pointermove',event=>{if(!sheetDrag||sheetDrag.id!==event.pointerId)return;sheetDrag.dy=Math.max(0,event.clientY-sheetDrag.startY);ui.panel.style.setProperty('--loadout-sheet-drag',`${Math.min(120,sheetDrag.dy)}px`);event.preventDefault();});
    const finish=event=>{if(!sheetDrag||sheetDrag.id!==event.pointerId)return;const shouldClose=sheetDrag.dy>=64;sheetDrag=null;ui.panel.style.setProperty('--loadout-sheet-drag','0px');delete ui.panel.dataset.dragging;if(shouldClose)close();};header.addEventListener('pointerup',finish);header.addEventListener('pointercancel',finish);
  }

  tracker.bindInteractions({openHeart:skillId=>open('heart',{skillId}),openTechnique:skillId=>open('technique',{skillId})});bindSheetGesture();
  ui.heart.onclick=()=>open('heart',{skillId:tracker.firstUnseen('heart')});ui.techniques.onclick=()=>open('technique',{skillId:tracker.firstUnseen('technique')});ui.bodyButton.onclick=()=>open('body');ui.items.onclick=()=>open('items');ui.close.onclick=close;
  return{...ui,bindState,refresh,open,close,discover:ids=>tracker.discover(ids),summary,dispose(){clearTimeout(movementHelpTimer);moveHint?.removeEventListener('click',showMovementHelp,{capture:true});loadoutUI.dispose();tracker.dispose();speech.dispose();root.remove();}};
}
