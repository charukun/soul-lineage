const BOOT_ID='soul-brand-boot';

export function applyBootBrand({markUrl,wordmark,ariaLabel}={}){
  if(typeof document==='undefined')return false;
  const gate=document.getElementById(BOOT_ID);
  if(!gate)return false;
  if(wordmark){
    const label=gate.querySelector('.wordmark');
    if(label)label.textContent=wordmark;
    gate.setAttribute('aria-label',ariaLabel||wordmark+' 起動');
  }
  if(markUrl){
    const mark=gate.querySelector('.mark');
    if(mark){
      const image=document.createElement('img');
      image.className='rinneBootMark';
      image.alt='';
      image.src=markUrl;
      Object.assign(image.style,{
        width:'min(48vw,220px)',height:'auto',aspectRatio:'1',objectFit:'contain',
        opacity:'1',filter:'drop-shadow(0 8px 22px rgba(26,37,28,.12))'
      });
      mark.replaceWith(image);
    }
  }
  return true;
}
