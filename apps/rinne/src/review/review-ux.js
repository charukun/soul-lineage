export function installReviewUX({reviewPresets,reviewWeapons}){
  const q=s=>document.querySelector(s);
  const style=document.createElement('style');
  style.textContent=`
    .model-strip{overflow:visible!important}.model-strip .model-chip{display:none!important}.model-select-trigger{width:100%;min-width:0;min-height:27px;border:1px solid #b4bda238;border-radius:999px;background:#12282980;color:#f0dfb3;padding:0 10px;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}.model-select-trigger:after{content:'⌄';float:right;color:var(--gold)}
    .weapon-quick{display:flex;align-items:center;gap:5px;padding:6px 12px;border-bottom:1px solid var(--line);overflow:hidden}.weapon-quick>span{flex:0 0 auto;font-size:8px;color:#90a697}.weapon-scroll{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;min-width:0}.weapon-scroll::-webkit-scrollbar{display:none}.weapon-chip{flex:0 0 auto;min-height:29px;border:1px solid #b4bda238;border-radius:999px;background:#12282980;color:#91a99d;padding:0 10px;font-size:8px}.weapon-chip.active{border-color:var(--gold);background:#d6bd8418;color:#f0dfb3}
    .motion-pair{grid-template-columns:1fr!important;gap:12px!important}.motion-pair>div{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px!important;padding:12px!important}.motion-pair label{grid-column:1/-1!important;font-size:10px!important;margin:0!important}.motion-pair .picker-trigger{grid-column:1/-1!important;min-height:44px!important;font-size:11px!important}.motion-pair .play-slot,.motion-pair .copy-slot{min-height:40px!important;width:100%!important;margin:0!important}.motion-pair .play-slot{grid-column:1}.motion-pair .copy-slot{grid-column:2}
    .review-page[data-review-page="reaction"] .single-review,.review-page[data-review-page="stance"] .single-review,.review-page[data-review-page="parry"] .single-review{grid-template-columns:minmax(0,1fr) 58px!important}.review-page[data-review-page="reaction"] .play-slot,.review-page[data-review-page="stance"] .play-slot,.review-page[data-review-page="parry"] .play-slot{display:none!important}.review-page[data-review-page="axis"] .stage-row{grid-template-columns:28px minmax(0,1fr) 46px!important}.review-page[data-review-page="axis"] .play-slot{display:none!important}.review-page[data-review-page="axis"] .copy-slot{min-height:37px!important}.instant-note{font-size:8px;color:#8da49a;margin:5px 0 0}.instant-note:before{content:'選ぶと即再生';color:var(--gold);margin-right:5px}
    .model-picker-backdrop{position:fixed;z-index:70;inset:0;background:#071719b5;display:flex;align-items:flex-end;backdrop-filter:blur(4px)}.model-picker-sheet{width:100%;max-height:72dvh;background:#1a3334;border-top:1px solid #d6bd8466;padding-bottom:env(safe-area-inset-bottom)}.model-picker-sheet header{height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid var(--line)}.model-picker-sheet header strong{font:15px var(--serif);color:var(--gold)}.model-picker-sheet header button{border:0;background:none;color:#a9b9ae}.model-picker-list{max-height:calc(72dvh - 44px);overflow:auto;padding:8px}.model-picker-item{width:100%;display:grid;grid-template-columns:44px minmax(0,1fr);gap:10px;align-items:center;text-align:left;border:1px solid transparent;border-bottom-color:#d6bd841f;background:transparent;color:#e9e2cd;padding:9px}.model-picker-item.active{border-color:#d6bd8466;background:#d6bd8410}.model-picker-item img{width:44px;height:44px;object-fit:cover;border-radius:50%;background:#102725}.model-picker-item span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.model-picker-item small{display:block;color:#88a097;font-size:8px;margin-top:2px}
    @media(min-width:900px){.model-picker-sheet{max-width:480px;margin:0 auto}.weapon-quick{padding:7px 14px}}
  `;
  document.head.append(style);

  const preset=q('#preset'),strip=q('.model-strip');
  if(strip&&preset){
    const trigger=document.createElement('button');trigger.type='button';trigger.className='model-select-trigger';trigger.textContent='キャラ: Sendagaya Shino';strip.append(trigger);
    const backdrop=document.createElement('div');backdrop.className='model-picker-backdrop';backdrop.hidden=true;
    backdrop.innerHTML='<section class="model-picker-sheet"><header><strong>キャラクター</strong><button type="button">閉じる</button></header><div class="model-picker-list"></div></section>';
    document.body.append(backdrop);const list=backdrop.querySelector('.model-picker-list'),close=backdrop.querySelector('header button');
    const portrait=id=>`./simulator/assets/portrait_${id}.webp`;
    function activeRow(){return reviewPresets.find(r=>r.id===preset.value)||reviewPresets[0];}
    function render(){const active=activeRow();list.replaceChildren(...reviewPresets.map(row=>{const id=row.label,b=document.createElement('button');b.type='button';b.className='model-picker-item'+(row.id===active?.id?' active':'');b.innerHTML=`<img src="${portrait(id)}" alt=""><span>${row.name||row.label}<small>${row.label}</small></span>`;b.onclick=()=>{preset.value=row.id;preset.dispatchEvent(new Event('change',{bubbles:true}));trigger.textContent=`キャラ: ${row.name||row.label}`;backdrop.hidden=true;render();};return b;}));}
    trigger.onclick=()=>{render();backdrop.hidden=false;};close.onclick=()=>backdrop.hidden=true;backdrop.addEventListener('click',e=>{if(e.target===backdrop)backdrop.hidden=true;});
    document.addEventListener('review-model-loaded',e=>{const row=reviewPresets.find(r=>r.id===e.detail?.presetId);if(row)trigger.textContent=`キャラ: ${row.name||row.label}`;});
  }

  const tabs=q('.review-tabs'),weaponSelect=q('#weapon-select'),weaponToggle=q('#weapon-toggle');
  if(tabs&&weaponSelect&&weaponToggle){
    const bar=document.createElement('div');bar.className='weapon-quick';bar.innerHTML='<span>武器</span><div class="weapon-scroll"></div>';const scroll=bar.querySelector('.weapon-scroll');
    const defs=[{id:'none',label:'なし'},...reviewWeapons];
    const setWeapon=id=>{const enabled=id!=='none';weaponToggle.checked=enabled;if(enabled){weaponSelect.value=id;weaponSelect.dispatchEvent(new Event('input',{bubbles:true}));weaponSelect.dispatchEvent(new Event('change',{bubbles:true}));}weaponToggle.dispatchEvent(new Event('input',{bubbles:true}));scroll.querySelectorAll('.weapon-chip').forEach(b=>b.classList.toggle('active',b.dataset.weapon===id));};
    defs.forEach((row,i)=>{const b=document.createElement('button');b.type='button';b.className='weapon-chip'+(i===0?' active':'');b.dataset.weapon=row.id;b.textContent=row.label;b.onclick=()=>setWeapon(row.id);scroll.append(b);});
    tabs.after(bar);
  }

  const immediateIds=new Set(['reaction-select','stance-select','parry-select','axis-shin','axis-gi','axis-tai']);
  document.addEventListener('change',event=>{
    const select=event.target;if(!(select instanceof HTMLSelectElement)||!select.classList.contains('review-select')||!immediateIds.has(select.id)||!select.value)return;
    const master=q('#clip');if(!master)return;master.value=select.value;master.dispatchEvent(new Event('change',{bubbles:true}));
  });
  for(const page of ['reaction','stance','parry','axis']){const node=q(`[data-review-page="${page}"]`);if(node&&!node.querySelector('.instant-note')){const note=document.createElement('p');note.className='instant-note';note.textContent='候補を一覧からタップして比較できます。';node.append(note);}}
}
