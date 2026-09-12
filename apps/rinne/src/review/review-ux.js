export function installReviewUX({reviewPresets,reviewWeapons}){
  const q=s=>document.querySelector(s);
  const style=document.createElement('style');
  style.textContent=`
    .model-strip{overflow:visible!important}.model-strip .model-chip{display:none!important}.model-select-trigger{width:100%;min-width:0;min-height:27px;border:1px solid #b4bda238;border-radius:999px;background:#12282980;color:#f0dfb3;padding:0 10px;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}.model-select-trigger:after{content:'⌄';float:right;color:var(--gold)}
    .weapon-quick{display:flex;align-items:center;gap:5px;padding:6px 12px;border-bottom:1px solid var(--line);overflow:hidden}.weapon-quick>span{flex:0 0 auto;font-size:8px;color:#90a697}.weapon-scroll{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;min-width:0}.weapon-scroll::-webkit-scrollbar{display:none}.weapon-chip{flex:0 0 auto;min-height:27px;border:1px solid #b4bda238;border-radius:999px;background:#12282980;color:#91a99d;padding:0 9px;font-size:8px}.weapon-chip.active{border-color:var(--gold);background:#d6bd8418;color:#f0dfb3}
    .motion-pair{grid-template-columns:1fr!important;gap:10px!important}.motion-pair>div{grid-template-columns:minmax(0,1fr) 94px 52px!important;padding:11px!important}.motion-pair label{font-size:10px!important}.motion-pair .picker-trigger{min-height:42px!important;font-size:11px!important}.motion-pair .play-slot,.motion-pair .copy-slot{min-height:42px!important}
    .model-picker-backdrop{position:fixed;z-index:70;inset:0;background:#071719b5;display:flex;align-items:flex-end;backdrop-filter:blur(4px)}.model-picker-sheet{width:100%;max-height:72dvh;background:#1a3334;border-top:1px solid #d6bd8466;padding-bottom:env(safe-area-inset-bottom)}.model-picker-sheet header{height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid var(--line)}.model-picker-sheet header strong{font:15px var(--serif);color:var(--gold)}.model-picker-sheet header button{border:0;background:none;color:#a9b9ae}.model-picker-list{max-height:calc(72dvh - 44px);overflow:auto;padding:8px}.model-picker-item{width:100%;display:grid;grid-template-columns:44px minmax(0,1fr);gap:10px;align-items:center;text-align:left;border:1px solid transparent;border-bottom-color:#d6bd841f;background:transparent;color:#e9e2cd;padding:9px}.model-picker-item.active{border-color:#d6bd8466;background:#d6bd8410}.model-picker-item img{width:44px;height:44px;object-fit:cover;border-radius:50%;background:#102725}.model-picker-item span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.model-picker-item small{display:block;color:#88a097;font-size:8px;margin-top:2px}
    @media(min-width:900px){.model-picker-sheet{max-width:480px;margin:0 auto}.weapon-quick{padding:7px 14px}}
  `;
  document.head.append(style);

  const preset=q('#preset'),strip=q('.model-strip');
  if(strip&&preset){
    const trigger=document.createElement('button');trigger.type='button';trigger.className='model-select-trigger';trigger.textContent='キャラ: SHINO';strip.append(trigger);
    const backdrop=document.createElement('div');backdrop.className='model-picker-backdrop';backdrop.hidden=true;
    backdrop.innerHTML='<section class="model-picker-sheet"><header><strong>キャラクター</strong><button type="button">閉じる</button></header><div class="model-picker-list"></div></section>';
    document.body.append(backdrop);const list=backdrop.querySelector('.model-picker-list'),close=backdrop.querySelector('header button');
    const names={SHINO:'Sendagaya Shino',A:'AvatarSample A',B:'AvatarSample B',C:'AvatarSample C',TSUKU:'Tsuku'};
    const portrait=id=>`./simulator/assets/portrait_${id}.webp`;
    function activeId(){const row=reviewPresets.find(r=>r.id===preset.value);return row?.label||'SHINO';}
    function render(){const active=activeId();list.replaceChildren(...reviewPresets.map(row=>{const id=row.label,b=document.createElement('button');b.type='button';b.className='model-picker-item'+(id===active?' active':'');b.innerHTML=`<img src="${portrait(id)}" alt=""><span>${names[id]||id}<small>${id}</small></span>`;b.onclick=()=>{preset.value=row.id;preset.dispatchEvent(new Event('change',{bubbles:true}));trigger.textContent=`キャラ: ${names[id]||id}`;backdrop.hidden=true;render();};return b;}));}
    trigger.onclick=()=>{render();backdrop.hidden=false;};close.onclick=()=>backdrop.hidden=true;backdrop.addEventListener('click',e=>{if(e.target===backdrop)backdrop.hidden=true;});
    document.addEventListener('click',e=>{const old=e.target.closest?.('.model-chip');if(!old)return;e.preventDefault();e.stopImmediatePropagation();const id=old.dataset.model,row=reviewPresets.find(r=>r.label===id);if(row){preset.value=row.id;preset.dispatchEvent(new Event('change',{bubbles:true}));trigger.textContent=`キャラ: ${names[id]||id}`;}},true);
  }

  const tabs=q('.review-tabs'),weaponSelect=q('#weapon-select'),weaponToggle=q('#weapon-toggle');
  if(tabs&&weaponSelect&&weaponToggle){
    const bar=document.createElement('div');bar.className='weapon-quick';bar.innerHTML='<span>武器</span><div class="weapon-scroll"></div>';const scroll=bar.querySelector('.weapon-scroll');
    const defs=[{id:'none',label:'なし'},...reviewWeapons];
    const setWeapon=id=>{const enabled=id!=='none';weaponToggle.checked=enabled;if(enabled){weaponSelect.value=id;weaponSelect.dispatchEvent(new Event('change',{bubbles:true}));}weaponToggle.dispatchEvent(new Event('input',{bubbles:true}));scroll.querySelectorAll('.weapon-chip').forEach(b=>b.classList.toggle('active',b.dataset.weapon===id));};
    defs.forEach((row,i)=>{const b=document.createElement('button');b.type='button';b.className='weapon-chip'+(i===0?' active':'');b.dataset.weapon=row.id;b.textContent=row.label;b.onclick=()=>setWeapon(row.id);scroll.append(b);});
    tabs.after(bar);
  }
}
