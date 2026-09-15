/** Same-device layout exchange, not multiplayer authority. Readers cannot publish.
 * A future host transport implements the same read/subscribe contract. */
export function createSharedWorldChannel({environment,writer=false,validate,window:win=window}){
  if(!['local','dev','prod','24h','day','night'].includes(environment))throw Error('Unknown world environment');
  const key=`soul.${environment}.world.mura.v1`;
  const decode=text=>text===null?null:validate(JSON.parse(text));
  return {
    read:()=>decode(win.localStorage.getItem(key)),
    publish(layout){if(!writer)throw Error('This game only reads the village layout');const value=JSON.stringify(validate(layout));if(value.length>4000000)throw Error('World layout is too large');if(win.localStorage.getItem(key)!==value)win.localStorage.setItem(key,value);},
    subscribe(listener,onError=()=>{}){const changed=e=>{if(e.key!==key||e.storageArea!==win.localStorage)return;try{listener(decode(e.newValue));}catch(error){onError(error);}};win.addEventListener('storage',changed);return()=>win.removeEventListener('storage',changed);},
  };
}
