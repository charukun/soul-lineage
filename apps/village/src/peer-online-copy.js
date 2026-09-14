import {installPeerAutoSignaling} from './peer-auto-signaling.js';
if(typeof document!=='undefined'){
  const intro=document.querySelector('#onlineDialog > p');
  if(intro)intro.textContent='同じ村の状態を複数端末で共有します。通常は「かんたん接続」を使い、Hostが離れると世界は闇に包まれ、安全なcheckpointを次のMURAAAAAAA端末が引き継ぐまで進行を止めます。';
  const install=()=>{const root=document.querySelector('#onlineHost .peer-world-panel');if(root&&!root.querySelector('.peer-auto-signaling'))installPeerAutoSignaling({root});};
  install();
  const observer=new MutationObserver(install);observer.observe(document.getElementById('onlineHost')||document.body,{childList:true,subtree:true});
}
