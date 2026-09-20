import {createReviewRoutes,mountReviewShell} from '@soul/shared-ui/review-shell';

// The review frame is shared with the original battle probe; the game stays headless.
export function mountBattle2ReviewShell({doc=document,win=window}={}){
  const header=doc.querySelector('.review-surface__header');
  if(!header)return null;
  const homeHref=new URL('/',win.location.href).href;
  const baseRoutes=createReviewRoutes({
    rinneBase:'https://soul-lineage-rinne-dev.c-okamoto.workers.dev/',
    charactersBase:'https://soul-lineage-character-studio-dev.c-okamoto.workers.dev/',
  });
  // Shared legacy entry filenames are not public URLs. Keep every destination extensionless.
  const routes=Object.fromEntries(Object.entries(baseRoutes).map(([id,href])=>{
    const url=new URL(href);url.pathname=url.pathname.replace(/\.html$/,'');return [id,url.href];
  }));
  routes.battle2=new URL('battle2',homeHref).href;
  const mounted=mountReviewShell({current:'battle2',routes:Object.freeze(routes),homeHref,header});
  if(!mounted)return null;
  const onKeyDown=event=>{
    if(event.key==='Escape'&&mounted.root.open){mounted.root.open=false;mounted.root.querySelector('summary')?.focus();}
  };
  const onPageHide=event=>{
    if(event.persisted)return;
    header.removeEventListener('keydown',onKeyDown);win.removeEventListener('pagehide',onPageHide);mounted.destroy();
  };
  header.addEventListener('keydown',onKeyDown);win.addEventListener('pagehide',onPageHide);
  return mounted;
}
if(typeof document!=='undefined'&&typeof window!=='undefined')mountBattle2ReviewShell();
