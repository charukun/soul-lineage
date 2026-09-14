import { validate } from './core.js';
import { createSaveEnvelope, readSaveEnvelope } from '@soul/game-data';
import { createIncrementalPatch,appendJournalEntry,replayJournal,shouldCompactJournal,journalBytes } from '@soul/world/incremental-journal';

export const SAVE_KEY = 'living-v5';
const JOURNAL_KEY=`${SAVE_KEY}.journal.v1`,COMPACT_KEY=`${SAVE_KEY}.compact.v1`,MAX_SAVE_BYTES=8_000_000,SAVE_ATTEMPTS=3,RETRY_DELAY_MS=40;
let peerReadOnly=false,freshVillageLoad=false;
export function setVillageSaveReadOnly(value){peerReadOnly=Boolean(value);return peerReadOnly;}
export function isVillageSaveReadOnly(){return peerReadOnly;}
export function consumeFreshVillageLoad(){const fresh=freshVillageLoad;freshVillageLoad=false;return fresh;}

export function createSaveStore(platform) {
 let tail=Promise.resolve(),blocked=false,error=null,revision=0,baseRevision=0,lastPayload=null,journal=null;
 const parseEnvelope=text=>{if(typeof text!=='string'||text.length>MAX_SAVE_BYTES)throw new Error('保存データが大きすぎます');return readSaveEnvelope(JSON.parse(text),{gameId:'village',playerId:'local'});};
 const writeWithRetry=async(key,value)=>{let cause;for(let attempt=1;attempt<=SAVE_ATTEMPTS;attempt++){try{await platform.storage.write(key,value);return;}catch(nextCause){cause=nextCause;if(attempt<SAVE_ATTEMPTS)await new Promise(resolve=>setTimeout(resolve,RETRY_DELAY_MS*attempt));}}throw cause;};
 const envelopeText=(rev,payload)=>JSON.stringify(createSaveEnvelope({gameId:'village',playerId:'local',revision:rev,updatedAt:platform.clock.now(),payload}));
 async function readBestBase(){const texts=await Promise.all([platform.storage.read(SAVE_KEY),platform.storage.read(COMPACT_KEY)]),candidates=[],failures=[];let present=0;for(const text of texts)if(text!==null){present++;try{candidates.push(parseEnvelope(text));}catch(cause){failures.push(cause);}}if(candidates.length){candidates.sort((a,b)=>b.revision-a.revision);return candidates[0];}if(present)throw failures[0]||new Error('保存snapshotを検証できません');return null;}
 return {
  async load(){try{const base=await readBestBase();freshVillageLoad=!base;if(!base){lastPayload=null;revision=baseRevision=0;journal=null;blocked=false;error=null;return null;}baseRevision=base.revision;let payload=base.payload,nextRevision=base.revision;const journalText=await platform.storage.read(JOURNAL_KEY);journal=journalText?JSON.parse(journalText):{version:1,baseRevision,entries:[]};if(journal.baseRevision===baseRevision){const replayed=replayJournal(payload,journal,{baseRevision});payload=replayed.payload;nextRevision=replayed.revision;}else{const latest=journal.entries?.at(-1)?.revision||journal.baseRevision;if(latest>baseRevision)throw new Error('保存差分の基準revisionが一致しません');journal={version:1,baseRevision,entries:[]};}revision=nextRevision;lastPayload=validate(payload);blocked=false;error=null;return structuredClone(lastPayload);}catch(cause){freshVillageLoad=false;blocked=true;error=cause;throw new Error('保存した村を読み込めませんでした。保存データは上書きしていません。',{cause});}},
  save(world){if(peerReadOnly)return Promise.resolve({skipped:'peer-read-only'});if(blocked)return Promise.reject(error||new Error('保存が保護されています'));const payload=JSON.parse(world.export()),operation=tail.catch(()=>{}).then(async()=>{
   if(lastPayload===null||baseRevision===0){const nextRevision=revision+1,text=envelopeText(nextRevision,payload);if(text.length>MAX_SAVE_BYTES)throw new Error('保存データが大きすぎます');await writeWithRetry(SAVE_KEY,text);await platform.storage.remove(JOURNAL_KEY).catch(()=>{});await platform.storage.remove(COMPACT_KEY).catch(()=>{});revision=baseRevision=nextRevision;journal={version:1,baseRevision,entries:[]};lastPayload=payload;return;}
   const ops=createIncrementalPatch(lastPayload,payload);if(!ops.length){lastPayload=payload;return;}
   const nextRevision=revision+1,nextJournal=appendJournalEntry(structuredClone(journal||{version:1,baseRevision,entries:[]}),{revision:nextRevision,updatedAt:platform.clock.now(),ops});
   if(shouldCompactJournal(nextJournal)||journalBytes(nextJournal)>1_200_000){const text=envelopeText(nextRevision,payload);if(text.length>MAX_SAVE_BYTES)throw new Error('保存データが大きすぎます');await writeWithRetry(COMPACT_KEY,text);await writeWithRetry(SAVE_KEY,text);await writeWithRetry(JOURNAL_KEY,JSON.stringify({version:1,baseRevision:nextRevision,entries:[]}));await platform.storage.remove(COMPACT_KEY).catch(()=>{});baseRevision=nextRevision;journal={version:1,baseRevision,entries:[]};}
   else{await writeWithRetry(JOURNAL_KEY,JSON.stringify(nextJournal));journal=nextJournal;}
   revision=nextRevision;lastPayload=payload;
  });tail=operation;operation.then(()=>{error=null;},cause=>{error=cause;});return operation;},
  async recover(){if(peerReadOnly)throw new Error('共通村へ接続中は個人ローカル保存を復旧できません');await tail.catch(()=>{});const[base,journalText,compact]=await Promise.all([platform.storage.read(SAVE_KEY),platform.storage.read(JOURNAL_KEY),platform.storage.read(COMPACT_KEY)]);if(base!==null||journalText!==null||compact!==null){const initial=`${SAVE_KEY}.recovery.${platform.clock.now()}`;let prefix=initial,suffix=0;while(await platform.storage.read(`${prefix}.base`)!==null||await platform.storage.read(`${prefix}.journal`)!==null||await platform.storage.read(`${prefix}.compact`)!==null)prefix=`${initial}.${++suffix}`;if(base!==null)await platform.storage.write(`${prefix}.base`,base);if(journalText!==null)await platform.storage.write(`${prefix}.journal`,journalText);if(compact!==null)await platform.storage.write(`${prefix}.compact`,compact);}await platform.storage.remove(SAVE_KEY);await platform.storage.remove(JOURNAL_KEY);await platform.storage.remove(COMPACT_KEY);freshVillageLoad=false;blocked=false;error=null;revision=baseRevision=0;lastPayload=null;journal=null;},
  flush:()=>tail,
  diagnostics:()=>Object.freeze({revision,baseRevision,journalEntries:journal?.entries?.length||0,journalBytes:journalBytes(journal),peerReadOnly,freshVillageLoad}),
  get error(){return error;},get blocked(){return blocked;},get readOnly(){return peerReadOnly;},
 };
}
