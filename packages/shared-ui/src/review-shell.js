import './review-shell.css';
import './review-controls.css';
import {REVIEW_PROBES,createReviewRoutes} from './review-manifest.js';
import {createReviewStageLifecycle,mountReviewStageControls} from './review-stage.js';

export {REVIEW_PROBES,createReviewRoutes,createReviewStageLifecycle,mountReviewStageControls};

const make=(tag,cls='',text='')=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node};

function card(probe,href,current){
  const link=make('a','review-probe-card');
  link.href=href;
  link.rel='noopener';
  link.dataset.current=String(probe.id===current);
  if(probe.id===current)link.setAttribute('aria-current','page');
  link.append(
    make('small','review-probe-card__tag',probe.tag),
    make('strong','review-probe-card__label',probe.label),
    make('span','review-probe-card__detail',probe.detail),
  );
  return link;
}

export function renderReviewProbeLinks(root,{routes={},current=''}={}){
  if(root)root.replaceChildren(...REVIEW_PROBES.flatMap(probe=>routes[probe.id]?[card(probe,routes[probe.id],current)]:[]));
}

export function normalizeReviewBackButton({header=document.querySelector('.review-surface__header'),href='',label='戻る',ariaLabel='Visual Reviewへ戻る'}={}){
  if(!header)return null;
  const title=header.querySelector('.review-surface__title');
  let back=header.querySelector('[data-review-back],.review-surface__back');
  if(!back&&title){back=make('a','review-surface__back');title.prepend(back)}
  if(!back)return null;
  back.classList.add('review-surface__back');
  back.dataset.reviewBack='true';
  if(href)back.href=href;
  back.textContent='‹ '+label;
  back.setAttribute('aria-label',ariaLabel);
  back.rel='noopener';
  return back;
}

export function mountReviewShell({current='',routes={},homeHref='',header=document.querySelector('.review-surface__header')}={}){
  if(!header)return null;
  normalizeReviewBackButton({header,href:homeHref});
  if(header.querySelector('[data-review-switcher]'))return null;
  const active=REVIEW_PROBES.find(probe=>probe.id===current);
  const root=make('details','review-switcher');
  const summary=make('summary','review-switcher__toggle');
  root.dataset.reviewSwitcher='true';
  summary.setAttribute('aria-label','レビュー画面を切り替える');
  summary.append(make('span','review-switcher__icon','☰'),make('span','review-switcher__label',active?.label||'画面'));
  const panel=make('div','review-switcher__panel');
  const head=make('div','review-switcher__head');
  head.append(make('small','','VISUAL REVIEW'),make('strong','','画面を切り替える'));
  panel.append(head);
  if(homeHref){
    const home=make('a','review-switcher__home','レビュー一覧');
    home.href=homeHref;
    home.rel='noopener';
    panel.append(home);
  }
  const grid=make('nav','review-switcher__grid');
  grid.setAttribute('aria-label','Visual Review画面');
  renderReviewProbeLinks(grid,{routes,current});
  panel.append(grid);
  root.append(summary,panel);
  header.append(root);
  const outside=event=>{if(root.open&&!root.contains(event.target))root.open=false};
  document.addEventListener('pointerdown',outside,true);
  return{root,destroy(){document.removeEventListener('pointerdown',outside,true);root.remove()}};
}
