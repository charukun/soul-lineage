import {muraSpeechPhrases} from '@soul/world/mura/dialogue';

const cleanText=value=>String(value||'').trim().replace(/\s+/g,' ').slice(0,80);

export function conversationAvailable(state){
  return Boolean(state&&state.zone==='village'&&!state.down&&!state.ended&&Number(state.ageYears)>=4);
}

export function resolveSpeechRecognition(windowLike){
  return windowLike?.SpeechRecognition||windowLike?.webkitSpeechRecognition||null;
}

export function createConversationInput({document,window:windowLike=globalThis.window,getState,onSpeak,onStatus=()=>{}}){
  const dock=document.getElementById('speech-dock'),fan=document.getElementById('speech-fan'),toggle=document.getElementById('speech-fan-toggle'),mic=document.getElementById('speech-mic');
  if(!dock||!fan||!toggle||!mic)throw Error('発話UIが見つかりません');
  const Recognition=resolveSpeechRecognition(windowLike),phrases=muraSpeechPhrases();
  let recognition=null,listening=false,open=false;

  fan.replaceChildren(...phrases.map((phrase,index)=>{
    const button=document.createElement('button');
    button.type='button';button.className='speech-phrase';button.dataset.intent=phrase.id;button.textContent=phrase.text;button.title=phrase.label;button.tabIndex=-1;
    button.setAttribute('aria-label',`${phrase.label}：${phrase.text}`);
    const angle=(200+(index*(80/Math.max(1,phrases.length-1))))*Math.PI/180,radius=94;
    button.style.setProperty('--fan-x',`${Math.cos(angle)*radius}px`);button.style.setProperty('--fan-y',`${Math.sin(angle)*radius}px`);
    button.addEventListener('click',event=>{event.stopPropagation();emit({source:'preset',intentId:phrase.id,text:phrase.text});closeFan();});
    return button;
  }));

  mic.hidden=!Recognition;mic.disabled=!Recognition;
  mic.setAttribute('aria-label',Recognition?'マイクで発話':'この端末ではマイク発話を利用できません');

  function emit({source,intentId=null,text}){
    const value=cleanText(text);if(!value||!conversationAvailable(getState?.()))return false;
    onSpeak?.({source,intentId,text:value});return true;
  }
  function setOpen(next){
    open=Boolean(next)&&conversationAvailable(getState?.());dock.classList.toggle('is-fan-open',open);fan.setAttribute('aria-hidden',String(!open));toggle.setAttribute('aria-expanded',String(open));
    for(const button of fan.querySelectorAll('.speech-phrase'))button.tabIndex=open?0:-1;
  }
  function closeFan(){setOpen(false);}
  function stopRecognition(){try{recognition?.abort?.();}catch{}recognition=null;listening=false;dock.classList.remove('is-listening');mic.setAttribute('aria-pressed','false');}
  function voiceError(code){
    if(code==='not-allowed'||code==='service-not-allowed')return'マイクが許可されていません';
    if(code==='no-speech')return'声を聞き取れませんでした';
    return'音声入力を使えませんでした';
  }
  function startVoice(){
    if(!Recognition||listening||!conversationAvailable(getState?.()))return false;
    closeFan();recognition=new Recognition();recognition.lang='ja-JP';recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=1;
    recognition.onstart=()=>{listening=true;dock.classList.add('is-listening');mic.setAttribute('aria-pressed','true');};
    recognition.onresult=event=>{const text=event?.results?.[0]?.[0]?.transcript;if(text)emit({source:'voice',text});};
    recognition.onerror=event=>{if(event?.error!=='aborted')onStatus(voiceError(event?.error));};
    recognition.onend=()=>{recognition=null;listening=false;dock.classList.remove('is-listening');mic.setAttribute('aria-pressed','false');};
    try{recognition.start();return true;}catch(error){recognition=null;listening=false;onStatus('音声入力を開始できませんでした');return false;}
  }
  function sync(){
    const available=conversationAvailable(getState?.());dock.hidden=!available;
    if(!available){closeFan();stopRecognition();}
    return available;
  }
  function outside(event){if(open&&!dock.contains(event.target))closeFan();}
  function keydown(event){if(event.key==='Escape')closeFan();}
  toggle.addEventListener('click',event=>{event.stopPropagation();setOpen(!open);});
  mic.addEventListener('click',event=>{event.stopPropagation();startVoice();});
  document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',keydown);
  sync();
  return{sync,open:()=>setOpen(true),close:closeFan,startVoice,isSupported:()=>Boolean(Recognition),dispose(){stopRecognition();closeFan();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',keydown);}};
}
