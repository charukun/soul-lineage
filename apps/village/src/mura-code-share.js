import {createSharedWorldChannel} from '@soul/platform-web/shared-world';
import {validateMuraLayout} from '@soul/world/mura';
import './mura-code-share.css';

const village=window.village;
if(village){
  const channel=createSharedWorldChannel({environment:village.info.environment,writer:true,validate:validateMuraLayout});
  const content=document.getElementById('dialogContent'),back=document.getElementById('muraDialogBack'),dialog=document.getElementById('dialog');
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const copy=async code=>{
    try{await navigator.clipboard.writeText(code);village.toast('村コードをコピーしました');}
    catch{const input=document.getElementById('muraVillageCodeValue');input?.focus();input?.select();village.toast('村コードを選択しました。コピーしてください');}
  };
  const showCode=()=>{
    let code='';try{code=channel.accessCode()||'';}catch(error){village.toast(`村コードを用意できません：${error.message}`);return;}
    content.innerHTML=`<section class="muraCodeShare"><h2>村コード</h2><p>輪廻転焦でこの村を選ぶためのコードです。</p><input id="muraVillageCodeValue" readonly value="${escape(code)}" aria-label="村コード"><button id="muraVillageCodeCopy" class="wide">コードをコピー</button><small>現在は同じブラウザ環境の村連携に使います。輪廻転焦側で明示入力した時だけ、この村の配置と内装を読み込みます。</small></section>`;
    dialog.dataset.page='village-code';back.hidden=false;back.onclick=()=>village.more();
    document.getElementById('muraVillageCodeCopy').onclick=()=>copy(code);
  };
  const install=()=>{
    const grid=content?.querySelector('.settingsGrid');if(!grid||grid.querySelector('#muraVillageCode'))return;
    const button=document.createElement('button');button.id='muraVillageCode';button.textContent='村コード';button.onclick=showCode;
    const online=grid.querySelector('#onlineOpen');if(online)online.insertAdjacentElement('afterend',button);else grid.append(button);
  };
  const observer=new MutationObserver(()=>install());observer.observe(content,{childList:true,subtree:true});install();
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
}
