/** Same-device layout exchange, not multiplayer authority. Readers cannot publish.
 * A reader must explicitly authorize with the village access code before the
 * shared MURA layout is exposed. A future host transport can keep the same
 * read/subscribe boundary without making RINNE a village writer. */
const CODE_ALPHABET='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const canonicalCode=value=>{
  let raw=String(value??'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(raw.startsWith('MURA'))raw=raw.slice(4);
  if(raw.length!==8||[...raw].some(char=>!CODE_ALPHABET.includes(char)))return null;
  return `MURA-${raw.slice(0,4)}-${raw.slice(4)}`;
};
const generateCode=win=>{
  const bytes=new Uint8Array(8);
  if(win.crypto?.getRandomValues)win.crypto.getRandomValues(bytes);
  else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
  return `MURA-${[...bytes.slice(0,4)].map(v=>CODE_ALPHABET[v%CODE_ALPHABET.length]).join('')}-${[...bytes.slice(4)].map(v=>CODE_ALPHABET[v%CODE_ALPHABET.length]).join('')}`;
};

export function createSharedWorldChannel({environment,writer=false,validate,window:win=window}){
  if(!['local','dev','prod','24h','day','night'].includes(environment))throw Error('Unknown world environment');
  const key=`soul.${environment}.world.mura.v1`,codeKey=`${key}.code`,authorizationKey=`${key}.reader-code`;
  const decode=text=>text===null?null:validate(JSON.parse(text));
  const storedCode=()=>canonicalCode(win.localStorage.getItem(codeKey));
  const ensureCode=()=>{
    const current=storedCode();if(current)return current;
    if(!writer)return null;
    const next=generateCode(win);win.localStorage.setItem(codeKey,next);return next;
  };
  const authorized=()=>writer||Boolean(storedCode()&&canonicalCode(win.localStorage.getItem(authorizationKey))===storedCode());
  const expose=text=>{
    const layout=decode(text);if(!layout||!authorized())return null;
    return writer?layout:{...layout,__sharedWorldCode:true};
  };
  return {
    read:()=>expose(win.localStorage.getItem(key)),
    accessCode:()=>ensureCode(),
    authorize(code){const expected=storedCode(),actual=canonicalCode(code);if(!expected||actual!==expected)return false;win.localStorage.setItem(authorizationKey,expected);return true;},
    clearAuthorization(){win.localStorage.removeItem?.(authorizationKey);},
    isAuthorized:authorized,
    publish(layout){if(!writer)throw Error('This game only reads the village layout');ensureCode();const value=JSON.stringify(validate(layout));if(value.length>4000000)throw Error('World layout is too large');if(win.localStorage.getItem(key)!==value)win.localStorage.setItem(key,value);},
    subscribe(listener,onError=()=>{}){const changed=e=>{if(e.key!==key||e.storageArea!==win.localStorage)return;try{listener(expose(e.newValue));}catch(error){onError(error);}};win.addEventListener('storage',changed);return()=>win.removeEventListener('storage',changed);},
  };
}
