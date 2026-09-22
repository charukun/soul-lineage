import {CURATED_MODEL_ASSETS,projectAssetUrl} from '@soul/assets';

// The native-rig review route is shared with Visual Review Lab, not a second
// model renderer or a new gameplay catalog. Existing studio choices stay intact.
function mount(){
  const panel=document.getElementById('panel-compare');if(!panel||document.getElementById('native-character-library'))return;
  const entries=CURATED_MODEL_ASSETS.filter(asset=>asset.kind==='character'&&asset.reviewOnly);
  if(!entries.length)return;
  const section=document.createElement('section');section.id='native-character-library';
  const title=document.createElement('h3');title.textContent='取り込み済み人物ライブラリ';
  const note=document.createElement('p');note.className='hint';note.textContent='原版の骨格・モーションで比較。選択すると同じ照明・床・身長基準でKayKitと並べます。本編の主人公は変更しません。';
  const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.5rem';
  for(const asset of entries){
    const link=document.createElement('a'),url=new URL('https://soul-lineage-rinne-dev.c-okamoto.workers.dev/review-objects');
    url.searchParams.set('category','characters');url.searchParams.set('asset',asset.id);url.searchParams.set('compare','both');
    link.href=url.href;link.dataset.nativeModel=asset.modelId;link.className='reference-archetype-card';link.style.minWidth='0';link.style.overflowWrap='anywhere';
    if(asset.thumbnailPath){const image=new Image();image.src=projectAssetUrl(asset.thumbnailPath,{environment:'dev'});image.alt=asset.label;image.loading='lazy';image.style.cssText='display:block;width:100%;aspect-ratio:1;object-fit:contain';link.append(image);}
    const label=document.createElement('strong');label.textContent=asset.label;const source=document.createElement('small');source.textContent=`${asset.author} · ${asset.license}`;link.append(label,source);grid.append(link);
  }
  section.append(title,note,grid);panel.prepend(section);
}
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
