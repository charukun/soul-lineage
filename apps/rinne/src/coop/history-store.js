import { appendHistory } from './history.js';

const prefix='coop-v2:';
const fingerprint=async value=>{
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
};

/** Web/device adapter. Inject one exclusive per-world lock; never advertise cloud durability. */
export function createHistoryStore({storage,exclusive,digest=fingerprint}){
  async function read(worldId){
    const raw=await storage.read(prefix+worldId);if(raw===null)return null;
    const envelope=JSON.parse(raw),{root,...body}=envelope;
    if(envelope.version!==2||envelope.checkpoint?.world.worldId!==worldId||!Array.isArray(envelope.history)||!Number.isSafeInteger(envelope.revision)||envelope.revision<1||await digest(body)!==root)throw Error('村の確定記録が壊れています。古い保存には戻しません。');
    return envelope;
  }
  async function commit(checkpoint,{writeId,acquire=false}){
    // Capture before waiting for the lock/IO; never persist a live mutable object.
    checkpoint=structuredClone(checkpoint);
    const worldId=checkpoint.world.worldId,epoch=checkpoint.world.epoch;
    const intentHash=await digest(checkpoint);
    return exclusive(worldId,async()=>{
      const previous=await read(worldId);
      if(previous?.writeId===writeId){
        if(previous.intentHash!==intentHash)throw Error('同じ保存要求の内容が違います。');
        return receipt(previous);
      }
      if(previous){
        const expected=previous.checkpoint.world.epoch+(acquire?1:0);
        if(epoch!==expected)throw Error('村の権限が更新されています。開き直してください。');
      }else if(!acquire)throw Error('村の確定記録がありません。');
      const body={version:2,revision:(previous?.revision||0)+1,writeId,intentHash,
        checkpoint,history:appendHistory(previous,checkpoint)};
      const envelope={...body,root:await digest(body)},encoded=JSON.stringify(envelope);
      if(new TextEncoder().encode(encoded).length>8*1024*1024)throw Error('村の保存容量が上限に達しました。');
      try{await storage.write(prefix+worldId,encoded);}
      catch(error){
        // A failed response does not establish that the atomic write failed.
        const found=await read(worldId);
        if(found?.writeId===writeId&&found.root===envelope.root)return receipt(found);
        throw error;
      }
      return receipt(envelope);
    });
  }
  function receipt(envelope){return{revision:envelope.revision,historySequence:envelope.history.length,root:envelope.root,writeId:envelope.writeId};}
  return{capabilities:{cloud:false,authenticatedAuthority:false},read,commit,
    async restore(worldId){const current=await read(worldId);return current?structuredClone(current.checkpoint):null;}};
}
