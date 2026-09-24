const $=selector=>document.querySelector(selector);
const games={rinne:'百年転生',village:'宝満叡智',demon:'喰滅廻遊',shared:'共通'};
const kinds={character:'キャラクター',scene:'プレイ画面',interface:'UI',world:'世界観',other:'その他'};
let items=[],visible=[],current=0;
const status=$('#status'),grid=$('#gallery-grid'),viewer=$('#viewer');
const errorMessage=async response=>{const body=await response.json().catch(()=>({}));return body.error||`HTTP ${response.status}`};
async function refresh(){
  try{
    const response=await fetch('./api/gallery',{cache:'no-store'});if(!response.ok)throw Error(await errorMessage(response));
    items=(await response.json()).items;render();
  }catch(error){status.textContent=`一覧を読み込めません: ${error.message}`}
}
function render(){
  visible=items.filter(item=>(!$('#game-filter').value||item.game===$('#game-filter').value)&&(!$('#kind-filter').value||item.kind===$('#kind-filter').value));
  grid.replaceChildren();
  for(const [index,item] of visible.entries()){
    const button=document.createElement('button');button.type='button';button.className='card';
    const img=document.createElement('img');img.src=item.media;img.alt='';img.loading='lazy';
    const label=document.createElement('span');label.textContent=item.title;
    const tag=document.createElement('small');tag.textContent=`${games[item.game]} · ${kinds[item.kind]}${item.source==='existing'?' · 既存資料':''}`;
    button.append(img,label,tag);button.addEventListener('click',()=>openViewer(index));grid.append(button);
  }
  status.textContent=visible.length?`${visible.length}枚を表示`:items.length?'該当する画像はありません':'画像を追加すると、ここに表示されます';
}
function openViewer(index){
  current=(index+visible.length)%visible.length;
  const item=visible[current];if(!item){viewer.close();return}
  $('#viewer-title').textContent=item.title;$('#viewer-image').src=item.media;$('#viewer-image').alt=item.title;
  $('#viewer-meta').textContent=`${games[item.game]} · ${kinds[item.kind]}${item.source==='existing'?' · 既存資料':item.createdAt?' · '+new Date(item.createdAt).toLocaleDateString('ja-JP'):''}`;
  $('#viewer-note').textContent=item.note||'';
  $('#previous').disabled=$('#next').disabled=visible.length<2;
  if(!viewer.open)viewer.showModal();
}
$('#game-filter').addEventListener('change',render);$('#kind-filter').addEventListener('change',render);
$('#add-button').addEventListener('click',()=>$('#upload').showModal());
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>$('#'+button.dataset.close).close());
$('#previous').addEventListener('click',()=>openViewer(current-1));$('#next').addEventListener('click',()=>openViewer(current+1));
viewer.addEventListener('keydown',event=>{if(event.key==='ArrowLeft')openViewer(current-1);if(event.key==='ArrowRight')openViewer(current+1)});
$('#upload-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,files=[...form.elements.image.files];
  if(!files.length)return;
  const submit=form.querySelector('[type=submit]');submit.disabled=true;
  try{
    for(const [index,file] of files.entries()){
      $('#upload-progress').textContent=`${index+1}/${files.length}枚を追加中…`;
      const body=new FormData();body.set('image',file);
      body.set('title',form.elements.title.value.trim()||file.name.replace(/\.[^.]+$/,'').slice(0,80));
      for(const key of ['game','kind','note'])body.set(key,form.elements[key].value);
      const response=await fetch('./api/gallery',{method:'POST',body});
      if(!response.ok)throw Error(`${file.name}: ${await errorMessage(response)}`);
    }
    form.reset();$('#upload-progress').textContent='';$('#upload').close();await refresh();
  }catch(error){$('#upload-progress').textContent=`追加できません: ${error.message}`;await refresh()}
  finally{submit.disabled=false}
});
$('#delete-button').addEventListener('click',async()=>{
  const item=visible[current];if(!item||!confirm(`「${item.title}」をギャラリーから削除しますか？\n${item.source==='existing'?'元の資料は残り、この一覧から非表示になります。':'この操作は取り消せません。'}`))return;
  const button=$('#delete-button');button.disabled=true;
  try{
    const response=await fetch(`./api/gallery/${item.id}`,{method:'DELETE'});
    if(!response.ok)throw Error(await errorMessage(response));
    viewer.close();await refresh();status.textContent='画像を削除しました';
  }catch(error){alert(`削除できません: ${error.message}`)}
  finally{button.disabled=false}
});
refresh();
