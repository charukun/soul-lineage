const clockRates=['1','5','10','20'];

function installClockRateButton(){
  const button=document.getElementById('clock-rate');
  if(!button||button.tagName!=='BUTTON')return;
  const render=()=>{
    const rate=clockRates.includes(String(button.value))?String(button.value):clockRates[0];
    button.textContent=`${rate}×`;
    button.setAttribute('aria-label',`世界時計の速さ ${rate}倍。押すと変更`);
  };
  render();
  new MutationObserver(render).observe(button,{attributes:true,attributeFilter:['value']});
  button.addEventListener('click',()=>{
    if(button.disabled)return;
    const current=clockRates.indexOf(String(button.value));
    button.value=clockRates[(current+1+clockRates.length)%clockRates.length];
    render();
    button.dispatchEvent(new Event('change',{bubbles:true}));
  });
}

function replaceRebirthVillageSelect(select){
  if(!select||select.dataset.appChoice==='ready')return;
  select.dataset.appChoice='ready';
  select.hidden=true;
  select.setAttribute('aria-hidden','true');
  select.tabIndex=-1;
  const label=select.closest('label');
  if(label)label.classList.add('rinne-choice-label');
  const choices=document.createElement('div');
  choices.className='rinne-choice-list';
  choices.setAttribute('role','radiogroup');
  choices.setAttribute('aria-label','次の出生');
  const buttons=[...select.options].map(option=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='rinne-choice';
    button.value=option.value;
    button.textContent=option.textContent;
    button.setAttribute('role','radio');
    button.addEventListener('click',()=>{select.value=button.value;sync();});
    choices.append(button);
    return button;
  });
  const sync=()=>{
    for(const button of buttons){
      const selected=button.value===select.value;
      button.setAttribute('aria-checked',String(selected));
      button.dataset.selected=String(selected);
    }
  };
  sync();
  if(label)label.after(choices);else select.after(choices);
}

installClockRateButton();
const installDynamicChoices=()=>replaceRebirthVillageSelect(document.getElementById('rebirth-village'));
installDynamicChoices();
new MutationObserver(installDynamicChoices).observe(document.body,{childList:true,subtree:true});
