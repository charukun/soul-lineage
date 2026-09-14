import {feastReward,nextPrey,scentBearing} from './feast-state.js';
import {PREY} from '@soul/raid/world';
import './feast.css';

export class FeastHud {
 constructor(hud){
  this.hud=hud;this.last=null;
  this.panel=document.createElement('div');this.panel.id='feast-feedback';this.panel.hidden=true;
  this.panel.setAttribute('role','status');this.panel.setAttribute('aria-live','polite');
  this.panel.innerHTML='<small data-feast="kicker"></small><strong data-feast="title"></strong><span data-feast="detail"></span><div class="feast-track"><i></i></div><span data-feast="progress"></span>';
  hud.append(this.panel);this.fields=Object.fromEntries([...this.panel.querySelectorAll('[data-feast]')].map(el=>[el.dataset.feast,el]));this.fill=this.panel.querySelector('i');
  this.tracker=document.createElement('div');this.tracker.id='prey-bearing';this.tracker.hidden=true;
  this.tracker.innerHTML='<b aria-hidden="true">↑</b><span></span>';
  hud.querySelector('#objective').append(this.tracker);
 }
 reset(){this.last=null;this.panel.hidden=true;this.tracker.hidden=true;delete this.hud.dataset.feasting;}
 event(e){
  if(e.type==='finish'){this.reset();return;}
  if(e.type!=='consume')return;
  const reward=feastReward(e);if(!reward)return;
  this.last={at:e.at,reward};this.panel.dataset.kind=reward.kind;
  this.fields.kicker.textContent=reward.kind==='form'?'新たな姿が、目覚める':reward.kind==='memory'?'喰らった命が、力になる':'喰らうほど、夜は続く';
  for(const key of ['title','detail','progress'])this.fields[key].textContent=reward[key];
  this.fill.style.width=`${Math.min(100,reward.fromCount/reward.goal*100)}%`;
 }
 target(game,returning=false){
  if(game.eaten<1)return null;
  const age=this.last?game.time-this.last.at:Infinity;
  if(age<.85)return null;
  return nextPrey(game,{returning:returning||game.targetEaten,revealed:age<9});
 }
 update(game,{returning=false,overlay=false}={}){
  const age=this.last?game.time-this.last.at:Infinity,feeding=Number.isFinite(game.player.devourProgress);
  const show=!game.finished&&!game.fight&&!overlay&&!feeding&&age<4.6;
  this.panel.hidden=!show;
  this.hud.dataset.feasting=feeding?'feeding':show?'reward':'';
  if(show){const r=this.last.reward,t=Math.max(0,Math.min(1,(age-.15)/.75));this.fill.style.width=`${(r.fromCount+(r.count-r.fromCount)*t)/r.goal*100}%`;this.panel.style.setProperty('--feast-opacity',String(Math.min(1,(4.6-age)/.5)));this.panel.style.setProperty('--feast-rise',`${Math.max(0,1-age/.26)*12}px`);}
  const target=overlay?null:this.target(game,returning);
  this.tracker.hidden=!target;
  if(target){
   this.tracker.querySelector('b').style.transform=`rotate(${scentBearing(game.player,target.npc)}rad)`;
   this.tracker.querySelector('span').textContent=`${target.fresh?'未知の記憶':'生命の気配'} · ${Math.ceil(target.distance)} m${target.npc.dead?' · 指を離して喰らう':''}`;
   const objective=this.hud.querySelector('#objective');
   objective.querySelector('small').textContent='次に狙う力';
   objective.querySelector('span').textContent=PREY[target.npc.role].power;
   const guide=objective.querySelector('#first-hunt-guide');guide.hidden=true;
   this.hud.dataset.guide='hunt';
  }
  return target;
 }
}
