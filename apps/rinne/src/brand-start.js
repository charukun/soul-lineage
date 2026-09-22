import {prepareRinneTitleAudio} from './gameplay-audio.js';
import {openBrandBootGate} from '@soul/shared-ui/boot-gate';

const RINNE_STEPS=[
  ['世界のしくみを呼び出しています',.20],
  ['村の地図をひらいています',.42],
  ['景色を描いています',.68],
  ['旅人を迎えています',.88],
];

await openBrandBootGate({
  load:async report=>{
    report(.08);
    const status=document.getElementById('boot-status');
    const game=document.getElementById('game');
    let statusObserver=null,gameObserver=null;
    const updateStatus=()=>{
      const text=String(status?.textContent||'');
      for(const [match,value] of RINNE_STEPS)if(text.includes(match))report(value);
    };
    const ready=new Promise((resolve,reject)=>{
      const finish=()=>{report(.92);statusObserver?.disconnect();gameObserver?.disconnect();resolve();};
      if(game?.dataset.runtime==='prepared'){finish();return;}
      statusObserver=new MutationObserver(updateStatus);
      if(status)statusObserver.observe(status,{childList:true,characterData:true,subtree:true});
      gameObserver=new MutationObserver(()=>{
        if(game?.dataset.runtime==='prepared')finish();
        else if(document.getElementById('title-retry')?.hidden===false){statusObserver?.disconnect();gameObserver?.disconnect();reject(new Error('rinne boot failed'));}
      });
      if(game)gameObserver.observe(game,{attributes:true,attributeFilter:['data-runtime']});
      updateStatus();
    });
    await import('./main.js');
    await ready;
    report(.96);
    await prepareRinneTitleAudio();
  },
});
