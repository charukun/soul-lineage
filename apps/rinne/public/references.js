const API_ROOT='https://api.github.com/repos/charukun/soul-lineage/contents/docs/characters/references';
const IMAGE_FILE=/\.(?:png|jpe?g|webp|avif|gif)$/i;
const EXCLUDED=new Set(['video-character-001']);
const TITLES=Object.freeze({shino:'Shino','npc-role-set':'NPC Role Set','kirishiro-shizuha':'霧白静刃 / Kirishiro Shizuha'});
const LABELS=Object.freeze({shino:'MASTER CHARACTER','npc-role-set':'NPC PRODUCTION SET','kirishiro-shizuha':'CHARACTER REFERENCE'});
const $=selector=>document.querySelector(selector);
const el=(tag,className='',text='')=>{const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node;};
const safeUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch{return null;}};
const titleFor=id=>TITLES[id]||id.split('-').filter(Boolean).map(part=>part[0]?.toUpperCase()+part.slice(1)).join(' ');
const labelFor=id=>LABELS[id]||'REFERENCE SET';
const rank=file=>{const name=(file.name||'').toLowerCase();if(name.includes('character-reference-sheet'))return 0;if(name.includes('reference-sheet'))return 1;return 2;};

async function github(path){
  const response=await fetch(path,{headers:{accept:'application/vnd.github+json'},cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error(`GitHub HTTP ${response.status}`);
  return response.json();
}

async function loadReferences(){
  const root=await github(`${API_ROOT}?ref=develop`);
  if(!Array.isArray(root))throw new Error('Reference root is invalid');
  const dirs=root.filter(item=>item?.type==='dir'&&!EXCLUDED.has(item.name)).sort((a,b)=>a.name.localeCompare(b.name));
  const groups=[];
  for(const dir of dirs){
    const files=await github(`${API_ROOT}/${encodeURIComponent(dir.name)}?ref=develop`);
    if(!Array.isArray(files))continue;
    const assets=files.filter(file=>file?.type==='file'&&IMAGE_FILE.test(file.name||'')&&safeUrl(file.download_url)).sort((a,b)=>rank(a)-rank(b)||a.name.localeCompare(b.name)).map(file=>({name:file.name,url:file.download_url,source:file.html_url,size:Number(file.size)||0}));
    if(!assets.length)continue;
    groups.push({id:dir.name,title:titleFor(dir.name),label:labelFor(dir.name),source:dir.html_url,assets});
  }
  return groups;
}

function assetCard(asset,index){
  const card=el('a',`reference-asset${index===0?' primary':''}`);card.href=safeUrl(asset.url)||'#';card.target='_blank';card.rel='noreferrer';
  const frame=el('div','image-frame'),img=document.createElement('img');img.src=asset.url;img.alt=asset.name;img.loading=index===0?'eager':'lazy';img.decoding='async';frame.append(img);
  const meta=el('div','asset-meta');meta.append(el('strong','',asset.name));if(asset.size)meta.append(el('span','',`${Math.max(1,Math.round(asset.size/1024))} KB`));card.append(frame,meta);return card;
}
function groupCard(group){
  const article=el('article','reference-group'),head=el('div','reference-group-head'),copy=el('div');copy.append(el('p','reference-kicker',group.label),el('h2','',group.title),el('p','reference-meta',`${group.assets.length} image${group.assets.length===1?'':'s'} / develop`));
  const source=el('a','source-link','GitHub');source.href=safeUrl(group.source)||'#';source.target='_blank';source.rel='noreferrer';head.append(copy,source);article.append(head);
  const grid=el('div',`reference-assets${group.assets.length===1?' single':''}`);group.assets.forEach((asset,index)=>grid.append(assetCard(asset,index)));article.append(grid);return article;
}
async function render(){
  const root=$('#reference-groups');root.replaceChildren(el('div','loading-card','キャラクターリファレンスを読み込んでいます。'));$('#reference-status').textContent='developを確認しています';
  try{
    const groups=await loadReferences();root.replaceChildren();groups.forEach(group=>root.append(groupCard(group)));const total=groups.reduce((sum,group)=>sum+group.assets.length,0);$('#reference-count').textContent=`${groups.length}セット / ${total}画像`;$('#reference-status').textContent='develop同期済み';
    if(!groups.length)root.append(el('div','loading-card','表示できるReference画像がありません。'));
  }catch(error){
    console.error(error);root.replaceChildren();const card=el('div','error-card');card.append(el('strong','','Reference一覧を取得できませんでした'),el('p','',`${error.message}。Lab本体はそのまま利用できます。`));const link=el('a','','Repositoryで確認');link.href='https://github.com/charukun/soul-lineage/tree/develop/docs/characters/references';link.target='_blank';link.rel='noreferrer';card.append(link);root.append(card);$('#reference-count').textContent='取得失敗';$('#reference-status').textContent='再読込できます';
  }
}
$('#reload')?.addEventListener('click',render);render();
