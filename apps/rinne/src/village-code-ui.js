import {createSharedWorldChannel} from '@soul/platform-web/shared-world';
import {validateMuraLayout} from '@soul/world/mura';

const info=typeof __BUILD_INFO__!=='undefined'?__BUILD_INFO__:{environment:'local'};
const channel=createSharedWorldChannel({environment:String(info.environment||'local'),validate:validateMuraLayout});
const dialog=document.getElementById('village-code-dialog'),open=document.getElementById('open-village-code'),input=document.getElementById('village-code-input'),status=document.getElementById('village-code-status');
const connected=document.getElementById('village-code-connected'),apply=document.getElementById('village-code-apply'),reset=document.getElementById('village-code-reset');

function sync(){
  const active=channel.isAuthorized(),layout=active?channel.read():null;
  connected.hidden=!layout;
  connected.textContent=layout?`接続中 · ${layout.name}`:'';
  reset.hidden=!active;
  if(!layout&&active){channel.clearAuthorization();status.textContent='共有村が見つかりません。風待ちの里を使います。';}
  else status.textContent=layout?'この村の配置と室内家具を次回の人生世界に使います。':'村アプリに表示された村コードを入力すると、その村へ切り替わります。';
}

open?.addEventListener('click',()=>{input.value='';sync();dialog.showModal();requestAnimationFrame(()=>input.focus());});
document.getElementById('close-village-code')?.addEventListener('click',()=>dialog.close());
apply?.addEventListener('click',()=>{
  if(!channel.authorize(input.value)){status.textContent='村コードが一致しません。村アプリの設定から最新コードを確認してください。';input.select();return;}
  const layout=channel.read();
  if(!layout){channel.clearAuthorization();status.textContent='村データを読み込めませんでした。風待ちの里を継続します。';return;}
  status.textContent=`${layout.name}へ切り替えます。`;
  location.reload();
});
reset?.addEventListener('click',()=>{channel.clearAuthorization();status.textContent='風待ちの里へ戻します。';location.reload();});
