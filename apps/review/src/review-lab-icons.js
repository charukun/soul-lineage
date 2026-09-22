export const REVIEW_MENU_ICONS=Object.freeze({
  characters:'<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.6-4.2 2.8-6.3 6.5-6.3s5.9 2.1 6.5 6.3"/>',
  motion:'<path d="M4 7h8l-2.4 2.4M20 17h-8l2.4-2.4"/><path d="M6.8 17.4 11 13l2.8-4.8 3.2 1.5"/>',
  equipment:'<path d="M12 3 19 6v5.4c0 4.2-2.6 7.4-7 9.6-4.4-2.2-7-5.4-7-9.6V6l7-3Z"/><path d="M12 5.2v13.2"/>',
  objects:'<path d="m12 3 7 4-7 4-7-4 7-4Z"/><path d="m5 7v8l7 4 7-4V7M12 11v8"/>',
  effects:'<path d="m12 3 1.5 4.3L18 9l-4.5 1.7L12 15l-1.5-4.3L6 9l4.5-1.7L12 3Z"/><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14ZM5 14l.6 1.7L7.3 16l-1.7.6L5 18.3l-.6-1.7L2.7 16l1.7-.3L5 14Z"/>',
  sounds:'<path d="M5 10h3l4-4v12l-4-4H5v-4Z"/><path d="M15 9.2c1.7 1.5 1.7 4.1 0 5.6M17.8 6.8c3.1 2.8 3.1 7.6 0 10.4"/>',
  battle:'<path d="m7 4 10 16M17 4 7 20"/><path d="m5 4 4 1-2 3M19 4l-4 1 2 3"/>',
  battle2:'<circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/><path d="M7.2 12h2.6M14.2 12h2.6"/>',
  battlebk:'<path d="m6 5 5 5-5 9M18 5l-5 5 5 9"/><path d="M4 5h4M16 5h4"/>',
  hybrid25d:'<rect x="3" y="5" width="8" height="14" rx="1.5"/><path d="m5 15 2-2 2 2M15 6l6 3.5-6 3.5-3-1.7V7.7L15 6Z"/><path d="M15 13v5m-2 1h4"/>',
  rinne:'<path d="M7 4c0 4-2 5.5-3 8 1 4 4 6.5 8 8 4-1.5 7-4 8-8-1-2.5-3-4-3-8-2 2-3.2 4-5 7-1.8-3-3-5-5-7Z"/>',
  village:'<path d="M4 11 12 4l8 7v9H4v-9Z"/><path d="M9 20v-5h6v5M8 11h.1M16 11h.1"/>',
  demon:'<path d="M12 4c4.5 0 7 2.3 7 5.8 0 4-3 7.2-7 10.2-4-3-7-6.2-7-10.2C5 6.3 7.5 4 12 4Z"/><path d="M8.8 10.5h.1M15.1 10.5h.1M9.5 15c1.6 1 3.4 1 5 0"/>',
  pulse:'<path d="M3 13h4l2-5 3 9 2-4h7"/><path d="M4 5h16v14H4z"/>'
});

function iconNode(doc,id){
  const body=REVIEW_MENU_ICONS[id];
  if(!body)return null;
  const span=doc.createElement('span');
  span.className='menu-card__icon';
  span.setAttribute('aria-hidden','true');
  span.innerHTML='<svg viewBox="0 0 24 24" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+body+'</svg>';
  return span;
}

export function decorateReviewMenuIcons({routes,doc=document,locationHref=location.href}={}){
  for(const [id,href] of Object.entries(routes||{})){
    if(!REVIEW_MENU_ICONS[id]||!href)continue;
    const absolute=new URL(href,locationHref).href;
    const probe=[...doc.querySelectorAll('#probe-grid a')].find(link=>link.href===absolute);
    if(probe&&!probe.querySelector('.menu-card__icon'))probe.prepend(iconNode(doc,id));
  }
  for(const link of doc.querySelectorAll('[data-route]')){
    const icon=iconNode(doc,link.dataset.route);
    if(icon&&!link.querySelector('.menu-card__icon'))link.prepend(icon);
  }
}
