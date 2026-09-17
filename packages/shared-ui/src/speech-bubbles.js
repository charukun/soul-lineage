import './speech-bubbles.css';

const defaultNow=()=>globalThis.performance?.now?.()??Date.now();
const finite=n=>Number.isFinite(Number(n))?Number(n):null;

export function createSpeechBubbles({document,layer,duration=5000,maxVisible=3,seenLimit=300,now=defaultNow}={}){
  if(!document||!layer)throw new Error('speech bubble layer is required');
  layer.classList.add('soul-speech-layer');
  const items=new Map(),seen=new Set();
  let sequence=0;

  function forgetOldSeen(){while(seen.size>seenLimit)seen.delete(seen.values().next().value);}
  function remove(id){const item=items.get(id);if(!item)return false;item.node.remove();items.delete(id);return true;}
  function trim(){while(items.size>maxVisible)remove(items.keys().next().value);}
  function show({id,text,personId=null,meta=null}={}){
    const value=String(text??'').trim();if(!value)return null;
    const key=String(id??`speech-${++sequence}-${Math.round(now())}`);if(items.has(key)||seen.has(key))return null;
    const node=document.createElement('div');node.className='soul-speech-bubble';node.textContent=value;node.dataset.speechId=key;if(personId!=null)node.dataset.personId=String(personId);layer.append(node);
    const item={id:key,node,text:value,personId,meta,created:now()};items.set(key,item);seen.add(key);forgetOldSeen();trim();return item;
  }
  function sync({resolve,blocked=false,time=now()}={}){
    for(const [id,item] of items){
      if(time-item.created>duration){remove(id);continue;}
      const point=resolve?.(item)??null;
      if(!point){item.node.hidden=true;continue;}
      const x=finite(point.x),y=finite(point.y),scale=finite(point.scale);
      if(x!=null)item.node.style.left=`${x}px`;if(y!=null)item.node.style.top=`${y}px`;
      if(scale!=null)item.node.style.setProperty('--speech-scale',String(Math.max(.35,Math.min(1.5,scale))));
      item.node.classList.toggle('micro',Boolean(point.micro));item.node.hidden=Boolean(blocked||point.hidden||point.visible===false||x==null||y==null);
    }
    trim();
  }
  function clear(){for(const item of items.values())item.node.remove();items.clear();}
  function dispose(){clear();layer.classList.remove('soul-speech-layer');}
  return{show,sync,remove,clear,dispose,has:id=>items.has(String(id)),seen:id=>seen.has(String(id)),get size(){return items.size;}};
}

export function suppressLegacySpeechMap(current){
  if(current?.[Symbol.iterator])for(const [,item] of current)item?.node?.remove?.();
  current?.clear?.();
  return new class SharedSpeechLegacyGuard extends Map{has(){return true;}}();
}
