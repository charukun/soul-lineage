/** Keep concurrent tabs from replacing a different main-game life. */
export async function acquireStorySaveLease(win,key,signal){
  if(!win.navigator.locks)return{persistent:false,release(){}};
  let release;const held=new Promise(resolve=>{release=resolve;});
  const lease=await new Promise((resolve,reject)=>{
    win.navigator.locks.request(key,{ifAvailable:true},lock=>{
      if(!lock){reject(Error('別のタブで本編を開いています。その本編を閉じてから再開してください。'));return;}
      resolve({persistent:true,release});return held;
    }).catch(reject);
  });
  if(signal?.aborted)release();else signal?.addEventListener('abort',release,{once:true});
  win.addEventListener('pagehide',release,{once:true});return lease;
}
