import './phase-panel.css';

const PHASES=Object.freeze(['jo','ha','kyu']);
const PHASE_LABELS=Object.freeze({jo:'序',ha:'破',kyu:'急'});
const SKIN_LABELS=Object.freeze({rinne:'輪廻転焦',jinku:'尽喰廻遊'});

function clamp01(value){
  const number=Number(value);
  if(!Number.isFinite(number))return 0;
  return Math.max(0,Math.min(1,number));
}

export function createPhasePanel(root,{skin='jinku',brand=SKIN_LABELS[skin]||'',details=true}={}){
  if(!root)throw new TypeError('phase panel root is required');
  root.classList.add('soul-phase-panel');
  root.dataset.details=details?'true':'false';
  root.innerHTML=`<div class="soul-phase-head"><span class="soul-phase-brand" data-phase-brand></span><strong class="soul-phase-current" data-phase-current>待</strong></div><div class="soul-phase-context"><span id="enemy-name" class="soul-phase-opponent" data-phase-opponent></span><strong id="skill-name" class="soul-phase-skill" data-phase-skill></strong></div><div class="soul-phase-track" aria-label="序破急"><span class="soul-phase-step" data-phase="jo" data-active="false"><b>序</b><small>JO</small></span><span class="soul-phase-step" data-phase="ha" data-active="false"><b>破</b><small>HA</small></span><span class="soul-phase-step" data-phase="kyu" data-active="false"><b>急</b><small>KYU</small></span></div><div id="enemy-health-track" class="soul-phase-health" role="progressbar" aria-label="相手の生命" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="enemy-health"></i></div><small class="soul-phase-meta" data-phase-meta></small>`;

  const brandNode=root.querySelector('[data-phase-brand]');
  const currentNode=root.querySelector('[data-phase-current]');
  const opponentNode=root.querySelector('[data-phase-opponent]');
  const skillNode=root.querySelector('[data-phase-skill]');
  const metaNode=root.querySelector('[data-phase-meta]');
  const healthTrack=root.querySelector('.soul-phase-health');
  const healthFill=root.querySelector('#enemy-health');
  const steps=[...root.querySelectorAll('[data-phase]')];

  function setSkin(nextSkin,nextBrand=SKIN_LABELS[nextSkin]||brandNode.textContent){
    if(!SKIN_LABELS[nextSkin])return;
    root.dataset.skin=nextSkin;
    brandNode.textContent=nextBrand;
  }

  function render({phase='',skill='',opponent='',opponentHp=0,opponentMaxHp=0,meta=''}={}){
    const active=PHASES.includes(phase)?phase:'';
    root.dataset.currentPhase=active||'idle';
    currentNode.textContent=PHASE_LABELS[active]||'待';
    skillNode.textContent=skill||'';
    opponentNode.textContent=opponent||'';
    metaNode.textContent=meta||'';
    for(const step of steps){
      const isActive=step.dataset.phase===active;
      step.dataset.active=String(isActive);
      step.classList.toggle('active',isActive);
      step.setAttribute('aria-current',isActive?'step':'false');
    }
    const max=Math.max(0,Number(opponentMaxHp)||0);
    const hp=Math.max(0,Number(opponentHp)||0);
    const ratio=max>0?clamp01(hp/max):0;
    healthFill.style.width=`${ratio*100}%`;
    healthTrack.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
    healthTrack.hidden=!details;
  }

  setSkin(skin,brand||SKIN_LABELS[skin]||'');
  render();
  return Object.freeze({root,setSkin,render,elements:Object.freeze({brand:brandNode,current:currentNode,opponent:opponentNode,skill:skillNode,meta:metaNode,healthTrack,healthFill,steps})});
}
