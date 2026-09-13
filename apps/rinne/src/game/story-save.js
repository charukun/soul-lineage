import {validateMuraLayout,defaultMuraLayout,LIMIT} from '@soul/world/mura';
import {Story} from './story.js';
const bounded=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
/** Reject incompatible envelopes without writing over the last playable life. */
export function readStorySave(raw){
  if(!raw||raw.version!==1||raw.game!=='rinne-story')throw Error('このファイルは輪廻転焦本編の保存データではありません。');
  const story=Story.validate(raw.story),r=raw.runtime,l=r?.life;
  if(r?.version!==1||l?.version!==1||!bounded(l.ageSeconds,0,5400)||!bounded(l.worldSeconds,l.ageSeconds,1e12)||!Number.isInteger(l.rate)||!bounded(l.rate,1,20)||l.lives!==story.generation||typeof l.enemiesEnabled!=='boolean')throw Error('年齢と世代の保存状態が一致しません。');
  if(Math.abs(l.worldSeconds-story.bornAt-l.ageSeconds)>.01||Math.abs(l.worldSeconds-story.lastWorld)>.01||(story.phase==='ended')!==(l.ageSeconds>=5400-1e-8))throw Error('本編と世界時計の保存状態が一致しません。');
  const validActor=a=>a&&bounded(a.x,-LIMIT,LIMIT)&&bounded(a.z,-LIMIT,LIMIT)&&bounded(a.maxhp,1,10000)&&bounded(a.hp,0,a.maxhp)&&typeof a.dead==='boolean'&&a.dead===(a.hp===0)&&['fist','sword','great','spear','axe','katana'].includes(a.weapon);
  if(!validActor(r.hero)||!Array.isArray(r.enemies)||r.enemies.length>3||r.enemies.some(a=>!validActor(a)))throw Error('体力・位置の保存状態が不正です。');
  if(story.zone==='village'&&r.enemies.length||story.zone==='frontier'&&!r.enemies.length||story.phase==='ended'&&!r.hero.dead)throw Error('場所と戦闘状態が一致しません。');
  if(!r.notebook||r.notebook.format!=='tidebreak-atelier')throw Error('技目録が見つかりません。');
  return {version:1,game:'rinne-story',world:validateMuraLayout(raw.world),story,runtime:JSON.parse(JSON.stringify(r))};
}
export function createStorySave(story,runtime,world=defaultMuraLayout()){
  const state=story.snapshot();state.lastWorld=runtime.life.worldSeconds;
  return readStorySave({version:1,game:'rinne-story',world,story:state,runtime});
}
