import {muraSpeechPhrases} from '@soul/world/mura/dialogue';

const cleanText=value=>String(value||'').trim().replace(/\s+/g,' ').slice(0,80);

export function conversationAvailable(state){
  return Boolean(state&&state.zone==='village'&&!state.down&&!state.ended&&Number(state.ageYears)>=4);
}

export function resolveSpeechRecognition(windowLike){
  return windowLike?.SpeechRecognition||windowLike?.webkitSpeechRecognition||null;
}

export function createConversationInput({document,window:windowLike=globalThis.window,root,getState,onSpeak=()=>{},onStatus=()=>{}}){
  if(!document||!root)throw Error('発話UIの接続先が見つかりません');
  const dock=document.createElement('div');dock.className='speech-dock';dock.hidden=true;
  dock.innerHTML='<div class="speech-output" role="status" aria-live="polite" hidden></div><div class="speech-fan" aria-label="定型文" aria-hidden="true"></div><div class="speech-controls"><button class="speech-fan-toggle" type="button" aria-label="定型文を開く" aria-expanded="false"><span aria-hidden="true">言</span></button><button class="speech-mic" type="button" aria-label="マイクで発話" aria-pressed="false"></button></div>';
  root.append(dock);
  const fan=dock.querySelector('.speech-fan'),toggle=dock.querySelector('.speech-fan-toggle'),mic=dock.querySelector('.speech-mic'),output=dock.querySelector('.speech-output');
  const Recognition=resolveSpeechRecognition(windowLike),phrases=muraSpeechPhrases();
  let recognition=null,listening=false,open=false,outputTimer=0;

  function feedback(text,kind='speech'){
    if(!text)return;output.textContent=text;output.dataset.kind=kind;output.hidden=false;clearTimeout(outputTimer);outputTimer=setTimeout(()=>{output.hidden=true;},2800);
  }
  function emit({source,intentId=null,text}){
    const value=cleanText(text);if(!value||!conversationAvailable(getState?.()))return false;
    feedback(value);onSpeak({source,intentId,text:value});return true;
  }
  function setOpen(next){
    open=Boolean(next)&&conversationAvailable(getState?.());dock.classList.toggle('is-fan-open',open);fan.setAttribute('aria-hidden',String(!open));toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'定型文を閉じる':'定型文を開く');
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
    recognition.onerror=event=>{if(event?.error!=='aborted'){const message=voiceError(event?.error);feedback(message,'error');onStatus(message);}};
    recognition.onend=()=>{recognition=null;listening=false;dock.classList.remove('is-listening');mic.setAttribute('aria-pressed','false');};
    try{recognition.start();return true;}catch{recognition=null;listening=false;const message='音声入力を開始できませんでした';feedback(message,'error');onStatus(message);return false;}
  }
  function sync(){
    const available=conversationAvailable(getState?.());dock.hidden=!available;
    if(!available){closeFan();stopRecognition();}
    return available;
  }
  function outside(event){if(open&&!dock.contains(event.target))closeFan();}
  function keydown(event){if(event.key==='Escape')closeFan();}

  fan.replaceChildren(...phrases.map((phrase,index)=>{
    const button=document.createElement('button');button.type='button';button.className='speech-phrase';button.dataset.intent=phrase.id;button.textContent=phrase.text;button.title=phrase.label;button.tabIndex=-1;button.setAttribute('aria-label',`${phrase.label}：${phrase.text}`);
    const progress=phrases.length>1?index/(phrases.length-1):0;button.style.setProperty('--fan-x',`${42+Math.sin(progress*Math.PI)*64}px`);button.style.setProperty('--fan-y',`${-(18+index*46)}px`);
    button.addEventListener('click',event=>{event.stopPropagation();emit({source:'preset',intentId:phrase.id,text:phrase.text});closeFan();});return button;
  }));
  mic.hidden=!Recognition;mic.disabled=!Recognition;mic.setAttribute('aria-label',Recognition?'マイクで発話':'この端末ではマイク発話を利用できません');
  toggle.addEventListener('click',event=>{event.stopPropagation();setOpen(!open);});mic.addEventListener('click',event=>{event.stopPropagation();startVoice();});document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',keydown);sync();
  return{sync,open:()=>setOpen(true),close:closeFan,startVoice,isSupported:()=>Boolean(Recognition),dispose(){stopRecognition();closeFan();clearTimeout(outputTimer);document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',keydown);dock.remove();}};
}
