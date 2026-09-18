import { recoverCheckpointWithSemanticShadow } from './semantic-shadow.js';

const clone=value=>structuredClone(value);
const PREFIX='coop-semantic-v1:';
const EVENT_TYPES=new Set(['birth','life-seal','rebirth','epoch-acquire']);
const encode=value=>JSON.stringify(value);
const bytes=value=>new TextEncoder().encode(encode(value)).byteLength;
const fingerprint=async value=>{
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(encode(value)));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
};
const keys=worldId=>({semantic:`${PREFIX}${worldId}:semantic`,provisional:`${PREFIX}${worldId}:provisional`});
const worldOf=checkpoint=>checkpoint?.world??checkpoint;

function requireCommit({checkpoint,events,semanticState,receipt}){
  const world=worldOf(checkpoint);
  if(!world||typeof world.worldId!=='string'||typeof world.ownerId!=='string')throw Error('semantic persistence: invalid checkpoint');
  if(!Array.isArray(events)||events.some(event=>!event||!EVENT_TYPES.has(event.type)))throw Error('semantic persistence: invalid event batch');
  if(!semanticState||semanticState.format!==1||semanticState.worldId!==world.worldId||semanticState.ownerId!==world.ownerId)throw Error('semantic persistence: projection mismatch');
  if(!Number.isSafeInteger(receipt?.revision)||receipt.revision<1||!Number.isSafeInteger(receipt?.historySequence)||receipt.historySequence<0)throw Error('semantic persistence: authority receipt missing');
  if(semanticState.authorityRoot!==(receipt.root??null)||semanticState.lastHistorySequence!==receipt.historySequence)throw Error('semantic persistence: authority anchor mismatch');
  return world;
}
async function unpack(raw,{worldId,kind,digest}){
  if(raw===null)return null;
  const envelope=JSON.parse(raw),{root,...body}=envelope;
  if(body.format!==1||body.worldId!==worldId||body.kind!==kind||await digest(body)!==root)throw Error(`semantic persistence: invalid ${kind} record`);
  return envelope;
}
function semanticRecord(event,{worldId,sequence,receipt,index}){
  return {sequence,eventId:`${worldId}:${receipt.revision}:${index}:${event.type}`,type:event.type,
    authorityRevision:receipt.revision,historySequence:receipt.historySequence,authorityRoot:receipt.root??null,payload:clone(event)};
}
function validateJournal(envelope){
  const rows=envelope?.journal;
  if(!Array.isArray(rows))throw Error('semantic persistence: invalid journal');
  let sequence=0;const ids=new Set();
  for(const row of rows){
    if(row?.sequence!==++sequence||typeof row.eventId!=='string'||ids.has(row.eventId)||!EVENT_TYPES.has(row.type)||row.payload?.type!==row.type)throw Error('semantic persistence: invalid journal sequence');
    ids.add(row.eventId);
  }
  if(envelope.semanticSequence!==sequence)throw Error('semantic persistence: journal cursor mismatch');
}

export function createSemanticJournalStore({storage,exclusive,digest=fingerprint,now=()=>Date.now(),provisionalRpoMs=2000,maxSemanticBytes=4*1024*1024}){
  if(!storage?.read||!storage?.write||typeof exclusive!=='function')throw Error('semantic persistence: storage adapter is required');
  if(!Number.isFinite(provisionalRpoMs)||provisionalRpoMs<250)throw Error('semantic persistence: invalid provisional RPO');

  async function readSemantic(worldId){
    const row=await unpack(await storage.read(keys(worldId).semantic),{worldId,kind:'semantic',digest});
    if(row)validateJournal(row);
    return row;
  }
  async function readProvisional(worldId){
    return unpack(await storage.read(keys(worldId).provisional),{worldId,kind:'provisional',digest});
  }
  async function writeBody(key,body,limit=Infinity){
    const envelope={...body,root:await digest(body)};
    if(bytes(envelope)>limit)throw Error('semantic persistence: journal capacity reached');
    await storage.write(key,encode(envelope));return envelope;
  }
  async function observe({checkpoint,events,semanticState,receipt}){
    checkpoint=clone(checkpoint);events=clone(events);semanticState=clone(semanticState);receipt=clone(receipt);
    const world=requireCommit({checkpoint,events,semanticState,receipt}),worldId=world.worldId,ownerId=world.ownerId;
    return exclusive(worldId,async()=>{
      const key=keys(worldId),current=await readSemantic(worldId);
      let semantic=current,wroteSemantic=false;
      const batchSignature=await digest({authorityRevision:receipt.revision,historySequence:receipt.historySequence,authorityRoot:receipt.root??null,events});
      if(!current||events.length){
        if(current){
          if(current.ownerId!==ownerId)throw Error('semantic persistence: owner changed');
          if(receipt.revision<current.lastSemanticRevision)throw Error('semantic persistence: stale semantic revision');
          if(receipt.revision===current.lastSemanticRevision){
            if(current.lastBatchSignature!==batchSignature)return receiptOf(current,await readProvisional(worldId),false,false);
          }
        }
        const start=current?.semanticSequence??0,records=events.map((event,index)=>semanticRecord(event,{worldId,sequence:start+index+1,receipt,index}));
        const body={format:1,kind:'semantic',worldId,ownerId,bootstrapRevision:current?.bootstrapRevision??receipt.revision,
          lastSemanticRevision:receipt.revision,lastHistorySequence:receipt.historySequence,lastAuthorityRoot:receipt.root??null,
          semanticSequence:start+records.length,journal:[...(current?.journal??[]),...records],semanticState,lastBatchSignature:batchSignature};
        semantic=await writeBody(key.semantic,body,maxSemanticBytes);wroteSemantic=true;
      }
      const currentProvisional=await readProvisional(worldId),stamp=now();
      const due=!currentProvisional||stamp-currentProvisional.savedAtMs>=provisionalRpoMs;
      let provisional=currentProvisional,wroteProvisional=false;
      if(due){
        const body={format:1,kind:'provisional',worldId,ownerId,authorityRevision:receipt.revision,
          historySequence:receipt.historySequence,authorityRoot:receipt.root??null,savedAtMs:stamp,checkpoint};
        provisional=await writeBody(key.provisional,body);wroteProvisional=true;
      }
      return receiptOf(semantic,provisional,wroteSemantic,wroteProvisional);
    });
  }
  function receiptOf(semantic,provisional,wroteSemantic,wroteProvisional){
    return {semanticRevision:semantic?.lastSemanticRevision??null,semanticSequence:semantic?.semanticSequence??0,
      provisionalRevision:provisional?.authorityRevision??null,wroteSemantic,wroteProvisional};
  }
  async function read(worldId){
    const [semantic,provisional]=await Promise.all([readSemantic(worldId),readProvisional(worldId)]);
    return {semantic:semantic?clone(semantic):null,provisional:provisional?clone(provisional):null};
  }
  async function recover(worldId){
    const current=await read(worldId);
    if(!current.semantic?.semanticState||!current.provisional?.checkpoint)return null;
    return recoverCheckpointWithSemanticShadow(current.provisional.checkpoint,current.semantic.semanticState);
  }
  return {capabilities:Object.freeze({authority:false,cloud:false,semanticEventSourcing:true,provisionalCheckpoint:true,combinedAtomicWrite:false,provisionalRpoMs}),
    observe,read,recover};
}
