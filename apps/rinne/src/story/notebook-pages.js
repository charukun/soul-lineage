import {mountPageLayout} from './page-layout.js';

/** Reorganize the existing editor controls; the native notebook remains their owner. */
export function mountNotebookPages(win) {
  const doc=win.document,$=id=>doc.getElementById(id),books=[],abort=new win.AbortController();
  const flatten=(...nodes)=>nodes.filter(Boolean).forEach(node=>node.classList.add('book-structure'));
  const captions=(...nodes)=>nodes.filter(Boolean).forEach(node=>node.classList.add('book-caption'));
  const all=(root,selector)=>[...root.querySelectorAll(selector)];
  const book=(host,chapters,watch=[])=>{const result=mountPageLayout(host,{chapters,label:'表示するページ',watch});books.push(result);return result;};
  const chapter=(title,nodes)=>({title,nodes:nodes.filter(Boolean)});
  doc.body.dataset.pageUi='true';
  // Keep help reachable even when the decorative footer is omitted in landscape.
  $('closeSettings').before($('helpBtn'));$('helpBtn').textContent='?';

  const overview=$('panel-overview');
  flatten(...all(overview,'.loadout-section,.attack-columns,.attack-column,.ratio-wrap,.candidate-cells,.defense-columns,.defense-columns>div'));
  captions(...all(overview,'.loadout-title,.loadout-section-title,.loadout-heading,.ratio-hint'));
  const fill=overview.querySelector('.fill-section');
  flatten(fill,fill.querySelector('.fill-controls'));
  captions(fill.querySelector('h3'));
  book(overview,()=>[
    ...['jo','ha','kyu'].map((key,i)=>chapter(['序の候補','破の候補','急の候補'][i],[
      ...all($('attack-cells-'+key),'.matrix-cell'),
    ])),
    ...['jo','ha','kyu'].map((key,i)=>chapter(['序の使用比率','破の使用比率','急の使用比率'][i],[
      $('ratio-'+key),...all($('ratio-'+key).parentElement,'.ratio-values label'),
    ])),
    chapter('防 · 心・技・体',all(overview,'.defense-cell')),
    chapter('ランダム補充',[...all(fill,'.fill-controls>label'),$('fillGridButton'),fill.querySelector('.fill-note'),$('fillFeedback')]),
  ],['jo','ha','kyu'].map(k=>$('attack-cells-'+k)).concat(['mind','uke','body'].map(k=>$('defense-cell-'+k))));
  // Ratio inputs are an explicit page, instead of a disclosure growing the candidates page.
  flatten(...all(overview,'.ratio-values'));

  const character=$('panel-character');
  flatten(...all(character,'.equipment-layout'),$('equipmentFields'));
  flatten(character.querySelector('.weapon-equipment')?.parentElement);
  captions(...all(character,':scope>.page-kicker,:scope>.panel-title,:scope>.panel-intro'),$('humanoidStatus'));
  book(character,()=>[
    chapter('装備する武器',[character.querySelector('.weapon-equipment'),$('weaponDescription'),...all(character,':scope>.book-viewport>.book-flow>.fineprint')]),
    chapter('旅する人物',[character.querySelector('.equipment-portrait'),$('avatar').closest('.form-block')]),
    chapter('身支度の手引き',all(character,':scope>.book-viewport>.book-flow>.note-box')),
    chapter('モデルの出典',[$('humanoidCredit'),character.querySelector('.humanoid-details')]),
  ]);

  const saved=$('panel-saved'),catalogHeader=saved.firstElementChild;
  flatten(catalogHeader,$('savedList'));
  captions(...all(catalogHeader,'.page-kicker,.panel-title,.panel-intro'));
  const catalogControls=doc.createElement('div');catalogControls.className='book-catalog-controls';
  catalogControls.append($('catalogSearch').parentElement,$('catalogFilters'),$('catalogCount'));saved.prepend(catalogControls);
  const savedBody=doc.createElement('div');savedBody.className='book-flex-body';
  savedBody.append(...[...saved.children].filter(node=>node!==catalogControls));saved.append(savedBody);
  flatten($('savedList'));
  book(savedBody,()=>{flatten($('savedList'));return [
    chapter('技目録', [...$('savedList').children]),
    chapter('保存・読込',[...all(savedBody,'.export-row,.review-details'),$('storageNotice'),...all(savedBody,'.book-flow>.fineprint')]),
  ];},[$('savedList')]);

  const skill=$('skillCompose');
  flatten(...all(skill,'.creator-main,.creator-aside,.creator-card,.identity-row,#stepsEditor'));
  flatten($('receiveBlock'));
  const actions=skill.querySelector('.equip-actions');flatten(actions,actions.querySelector('.row'));
  captions(...all(skill,'.creator-card>.section-heading'));
  const identity=skill.querySelector('.creator-main>.creator-card');
  const generation=skill.querySelectorAll('.creator-main>.creator-card')[1];
  book(skill,()=>[
    chapter('名前',[identity.querySelector('.editor-state'),...all(identity,'.identity-row>label,.identity-row>.form-block,.creator-auto-name')]),
    chapter('下書き',[...generation.children].filter(n=>!n.classList.contains('section-heading'))),
    ...all($('stepsEditor'),'.craft-action').map((node,i)=>chapter('動作 '+(i+1),[node])),
    chapter('被弾後の型',[...$('receiveBlock').children]),
    ...all(skill,'.creator-aside>.creator-card').map(node=>chapter(node.querySelector('.section-heading')?.textContent||'仕上げ',[...node.children].filter(n=>!n.classList.contains('section-heading')).flatMap(n=>n===actions?[...n.querySelectorAll('button')]:[n]))),
  ]);
  for(const id of ['mindCompose','bodyCompose']){
    const host=$(id);captions(...all(host,':scope>.eyebrow,:scope>.panel-title,:scope>.panel-intro'));
    captions(host.querySelector('.mind-heading'));
    book(host,()=>[chapter(id==='mindCompose'?'心構え':'残心',[...host.querySelector('.book-flow').children].filter(n=>!n.classList.contains('book-caption')))]);
  }
  const settings=$('panel-settings');flatten(...all(settings,'.settings-grid,.settings-grid>section'));
  captions(...all(settings,'.sep,.subhead'));
  book(settings,()=>[chapter('稽古の設定',[
    $('lifeEnemyInline'),...all(settings,'.settings-grid>section>.form-block,.settings-grid>section>.check-row,.settings-grid>section>.fineprint'),$('resetBtn'),settings.querySelector('.review-details'),
  ])]);

  const picker=$('catalogPicker'),items=$('pickerItems');
  // renderPicker replaces pickerItems children. Keep the book outside that native list.
  const pickerBody=doc.createElement('div');pickerBody.className='book-flex-body';items.before(pickerBody);pickerBody.append(items);flatten(items);
  const pickerGuide=picker.querySelector('.picker-footer');pickerBody.append(pickerGuide);
  const pickPages=book(pickerBody,()=>[chapter('選択候補',[...items.children]),chapter('選び方',[pickerGuide])],[items]);
  $('pickerQuery').addEventListener('input',()=>{pickPages.refresh();},{signal:abort.signal});
  picker.addEventListener('keydown',event=>{
    if(event.target!==$('pickerQuery')||!['ArrowDown','ArrowUp'].includes(event.key))return;
    const options=all(items,'.picker-option'),target=event.key==='ArrowDown'?options[0]:options.at(-1);
    if(target){event.preventDefault();event.stopImmediatePropagation();pickPages.showNode(target);target.focus({preventScroll:true});}
  },{capture:true,signal:abort.signal});

  function simpleDialog(id,headerSelector,closeSelector){
    const host=$(id),header=host.querySelector(headerSelector),close=host.querySelector(closeSelector);
    const body=doc.createElement('div');body.className='book-flex-body';
    body.append(...[...host.children].filter(n=>n!==header&&n!==close));host.append(body);if(close)host.append(close);
    host.classList.add('book-dialog');
    book(body,()=>[chapter(header?.textContent.trim()||'手引き',[...body.querySelector('.book-flow').children])]);
  }
  simpleDialog('help','h2','#closeHelp');
  simpleDialog('lifeDialog','.life-dialog-head','#lifeResume');
  const life=$('lifeDialog');flatten(...all(life,'.life-section'));
  // Split world-clock controls at their natural boundaries, retaining native IDs and callbacks.
  const lifeBook=books.pop();lifeBook.destroy();
  const lifeBody=life.querySelector('.book-flex-body');
  book(lifeBody,()=>[chapter('時の流れ',all(lifeBody,'.book-flow>.life-age-display,.book-flow>.life-help,.book-flow>.life-saved,.life-section>label,.life-section>input,.life-presets,.life-section>p'))]);
  simpleDialog('cameraDialog','.camera-title','#cameraHome');
  const refresh=()=>books.forEach(b=>b.refresh());
  doc.addEventListener('click',event=>{if(!event.target.closest('.book-pages'))refresh();},{signal:abort.signal});
  return()=>{abort.abort();for(const b of books.reverse())b.destroy();delete doc.body.dataset.pageUi;};
}
