import './review-shell.css';
export const REVIEW_PROBES=Object.freeze([{id:'characters',label:'キャラクター',detail:'形状・個体差・年齢・シルエット',tag:'MODEL'},{id:'motion',label:'モーション',detail:'姿勢・遷移・接触・再生',tag:'MOTION'},{id:'equipment',label:'装備',detail:'装着・干渉・輪郭・モデル差',tag:'EQUIP'},{id:'objects',label:'物体',detail:'小物・ワールド資産・尺度',tag:'OBJECT'},{id:'effects',label:'エフェクト',detail:'VFX・同期・視認性・負荷',tag:'VFX'},{id:'sounds',label:'サウンド',detail:'効果音・BGM・単独試聴',tag:'AUDIO'},{id:'battle',label:'戦闘演出',detail:'段・技・連・序破急・実演',tag:'BATTLE'},{id:'battle2',label:'序破急バトルシステム',detail:'百年転生へ段階統合する新戦闘基盤',tag:'BATTLE'},{id:'battlebk',label:'戦闘演出bk',detail:'戦闘演出2のバックアップ',tag:'BATTLE'}]);
const FILES={motion:'review-motion.html',equipment:'review-assets.html',objects:'review-objects.html',effects:'review-effects.html',sounds:'review-sound.html',battle:'review-battle.html'};
const make=(tag,cls='',text='')=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n};
export function createReviewRoutes({rinneBase,charactersBase}={}){const routes={};if(charactersBase)routes.characters=new URL(charactersBase,location.href).href;if(rinneBase){const base=new URL(rinneBase,location.href);for(const [id,path] of Object.entries(FILES))routes[id]=new URL(path,base).href}return Object.freeze(routes)}
function card(p,href,current){const a=make('a','review-probe-card');a.href=href;a.rel='noopener';a.dataset.current=String(p.id===current);if(p.id===current)a.setAttribute('aria-current','page');a.append(make('small','review-probe-card__tag',p.tag),make('strong','review-probe-card__label',p.label),make('span','review-probe-card__detail',p.detail));return a}
export function renderReviewProbeLinks(root,{routes={},current=''}={}){if(root)root.replaceChildren(...REVIEW_PROBES.flatMap(p=>routes[p.id]?[card(p,routes[p.id],current)]:[]))}
export function normalizeReviewBackButton({header=document.querySelector('.review-surface__header'),href='',label='戻る',ariaLabel='Visual Reviewへ戻る'}={}){
  if(!header)return null;
  const title=header.querySelector('.review-surface__title');
  let back=header.querySelector('[data-review-back],.review-surface__back');
  if(!back&&title){back=make('a','review-surface__back');title.prepend(back)}
  if(!back)return null;
  back.classList.add('review-surface__back');back.dataset.reviewBack='true';
  if(href)back.href=href;back.textContent='‹ '+label;back.setAttribute('aria-label',ariaLabel);back.rel='noopener';
  return back;
}
export function mountReviewStageControls({stage=document.querySelector('.review-surface__stage'),groups=[],label='表示・再生コントロール'}={}){
  if(!stage||stage.querySelector('[data-review-stage-controls]'))return null;
  const nodes=groups.flatMap(selector=>[...document.querySelectorAll(selector)]).filter((node,index,all)=>node&&!all.slice(0,index).some(parent=>parent.contains(node)));
  const root=make('div','review-stage-controls');root.dataset.reviewStageControls='true';
  const button=make('button','review-stage-controls__button','⚙');button.type='button';button.setAttribute('aria-label',label);button.setAttribute('aria-expanded','false');
  const panel=make('div','review-stage-controls__panel');panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label',label);
  const title=make('strong','review-stage-controls__title',label);panel.append(title,...nodes);root.append(panel,button);stage.append(root);
  const setOpen=open=>{panel.hidden=!open;root.dataset.open=String(open);button.setAttribute('aria-expanded',String(open));};
  button.addEventListener('click',event=>{event.stopPropagation();setOpen(panel.hidden)});
  const outside=event=>{if(!panel.hidden&&!root.contains(event.target))setOpen(false)};
  const escape=event=>{if(event.key==='Escape'&&!panel.hidden){setOpen(false);button.focus()}};
  document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape);
  return{root,destroy(){document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape);for(const node of nodes)node.remove();root.remove()}};
}
export function createReviewStageLifecycle({canvas,stage=canvas?.closest('.review-surface__stage')||canvas?.parentElement,onResize,render,win=window}={}){
  if(!canvas||!stage||typeof onResize!=='function')throw new Error('Review stage lifecycle requires canvas, stage and onResize');
  let raf=0,destroyed=false,lastWidth=0,lastHeight=0;
  const apply=()=>{raf=0;if(destroyed)return false;const rect=stage.getBoundingClientRect(),width=Math.floor(stage.clientWidth),height=Math.floor(stage.clientHeight);if(width<2||height<2)return false;if(width===lastWidth&&height===lastHeight)return false;lastWidth=width;lastHeight=height;onResize({width,height,aspect:width/height,rect});render?.();return true};
  const refresh=()=>{if(destroyed||raf)return;raf=win.requestAnimationFrame(apply)};
  const observer=new win.ResizeObserver(refresh);observer.observe(stage);
  win.addEventListener('resize',refresh,{passive:true});win.addEventListener('orientationchange',refresh,{passive:true});win.visualViewport?.addEventListener('resize',refresh,{passive:true});refresh();
  return Object.freeze({refresh,get size(){return Object.freeze({width:lastWidth,height:lastHeight})},destroy(){if(destroyed)return;destroyed=true;observer.disconnect();if(raf)win.cancelAnimationFrame(raf);win.removeEventListener('resize',refresh);win.removeEventListener('orientationchange',refresh);win.visualViewport?.removeEventListener('resize',refresh)}});
}
export function mountReviewShell({current='',routes={},homeHref='',header=document.querySelector('.review-surface__header')}={}){if(!header)return null;normalizeReviewBackButton({header,href:homeHref});if(header.querySelector('[data-review-switcher]'))return null;const active=REVIEW_PROBES.find(p=>p.id===current),root=make('details','review-switcher'),summary=make('summary','review-switcher__toggle');root.dataset.reviewSwitcher='true';summary.setAttribute('aria-label','レビュー画面を切り替える');summary.append(make('span','review-switcher__icon','☰'),make('span','review-switcher__label',active?.label||'画面'));const panel=make('div','review-switcher__panel'),head=make('div','review-switcher__head');head.append(make('small','','VISUAL REVIEW'),make('strong','','画面を切り替える'));panel.append(head);if(homeHref){const home=make('a','review-switcher__home','レビュー一覧');home.href=homeHref;home.rel='noopener';panel.append(home)}const grid=make('nav','review-switcher__grid');grid.setAttribute('aria-label','Visual Review画面');renderReviewProbeLinks(grid,{routes,current});panel.append(grid);root.append(summary,panel);header.append(root);const outside=e=>{if(root.open&&!root.contains(e.target))root.open=false};document.addEventListener('pointerdown',outside,true);return{root,destroy(){document.removeEventListener('pointerdown',outside,true);root.remove()}}}
