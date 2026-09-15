const clone=value=>structuredClone(value);
const encoder=new TextEncoder();
const isObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const entityArray=value=>Array.isArray(value)&&value.every(item=>isObject(item)&&Object.hasOwn(item,'id'))&&new Set(value.map(item=>String(item.id))).size===value.length;
const own=(target,key)=>Object.hasOwn(target,key)?target[key]:undefined;
function setOwn(target,key,value){Object.defineProperty(target,key,{value,writable:true,enumerable:true,configurable:true});}
const same=(a,b)=>Object.is(a,b)||JSON.stringify(a)===JSON.stringify(b);
const bytes=value=>encoder.encode(JSON.stringify(value??null)).byteLength;

function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(!isObject(value))return value;
 const out=Object.create(null);for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;
}
export function checkpointDigest(value){
 const text=JSON.stringify(stable(value));let hash=0x811c9dc5;
 for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,0x01000193)>>>0;}
 return hash.toString(16).padStart(8,'0');
}
function mergePatch(before,after){
 if(same(before,after))return null;
 if(!isObject(before)||!isObject(after))return{$set:clone(after)};
 const patch={};let changed=false;
 for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
  if(!Object.hasOwn(after,key)){setOwn(patch,key,{$delete:true});changed=true;continue;}
  const child=mergePatch(own(before,key),after[key]);if(child!==null){setOwn(patch,key,child);changed=true;}
 }
 return changed?patch:null;
}
function applyMerge(target,patch){
 if(patch&&Object.hasOwn(patch,'$set'))return clone(patch.$set);
 if(patch&&Object.hasOwn(patch,'$delete')&&patch.$delete)return undefined;
 const out=isObject(target)?target:{};
 for(const[key,child]of Object.entries(patch||{})){const value=applyMerge(own(out,key),child);if(value===undefined&&child&&Object.hasOwn(child,'$delete')&&child.$delete)delete out[key];else setOwn(out,key,value);}
 return out;
}
function atPath(root,path){if(!Array.isArray(path))throw new Error('Invalid checkpoint path');let node=root;for(const key of path){if((typeof key!=='string'&&!Number.isSafeInteger(key))||node===null||typeof node!=='object'||!Object.hasOwn(node,key))throw new Error('Checkpoint path is not an own property');node=node[key];}return node;}
function createOps(before,after){
 const ops=[];
 function walk(a,b,path){
  if(same(a,b))return;
  if(entityArray(a)&&entityArray(b)){
   const left=new Map(a.map(v=>[String(v.id),v])),right=new Map(b.map(v=>[String(v.id),v]));
   const replayOrder=[...left.keys()].filter(id=>right.has(id)).concat([...right.keys()].filter(id=>!left.has(id)));
   if(!same(replayOrder,[...right.keys()])){ops.push({op:'set',path,value:clone(b)});return;}
   for(const[id,value]of right){if(!left.has(id)){ops.push({op:'entity-set',path,id,value:clone(value)});continue;}const patch=mergePatch(left.get(id),value);if(patch)ops.push({op:'entity-patch',path,id,patch});}
   for(const id of left.keys())if(!right.has(id))ops.push({op:'entity-delete',path,id});return;
  }
  if(isObject(a)&&isObject(b)){
   for(const key of new Set([...Object.keys(a),...Object.keys(b)])){if(!Object.hasOwn(b,key))ops.push({op:'delete',path:[...path,key]});else if(!Object.hasOwn(a,key))ops.push({op:'set',path:[...path,key],value:clone(b[key])});else walk(a[key],b[key],[...path,key]);}
   return;
  }
  ops.push({op:'set',path,value:clone(b)});
 }
 walk(before,after,[]);return ops;
}
function applyOps(base,ops){
 let root=clone(base);
 for(const op of ops||[]){
  if(!op.path?.length&&op.op==='set'){root=clone(op.value);continue;}
  if(op.op==='entity-set'||op.op==='entity-patch'||op.op==='entity-delete'){
   const list=atPath(root,op.path);if(!Array.isArray(list))throw new Error('Checkpoint entity path is not an array');
   const index=list.findIndex(item=>String(item?.id)===String(op.id));
   if(op.op==='entity-delete'){if(index>=0)list.splice(index,1);continue;}
   if(op.op==='entity-set'){if(index>=0)list[index]=clone(op.value);else list.push(clone(op.value));continue;}
   if(index<0)throw new Error(`Checkpoint entity missing: ${op.id}`);list[index]=applyMerge(list[index],op.patch);continue;
  }
  if(!Array.isArray(op.path)||!op.path.length)throw new Error('Invalid checkpoint path');
  const parent=atPath(root,op.path.slice(0,-1)),key=op.path.at(-1);
  if(parent===null||typeof parent!=='object'||(typeof key!=='string'&&!Number.isSafeInteger(key)))throw new Error('Invalid checkpoint target');
  if(op.op==='delete')delete parent[key];else if(op.op==='set')setOwn(parent,key,clone(op.value));else throw new Error(`Unknown checkpoint op: ${op.op}`);
 }
 return root;
}
function validRevision(value){return Number.isSafeInteger(value)&&value>=0;}
export function createCheckpointDelta(before,after,{epoch,fromRevision,toRevision}={}){
 if(!Number.isSafeInteger(epoch)||epoch<1||!validRevision(fromRevision)||!validRevision(toRevision)||toRevision!==fromRevision+1)throw new Error('Invalid checkpoint delta revision');
 const entry={version:1,epoch,fromRevision,toRevision,baseDigest:checkpointDigest(before),resultDigest:checkpointDigest(after),ops:createOps(before,after)};
 entry.bytes=bytes(entry);return entry;
}
export function applyCheckpointDelta(base,entry,{epoch=entry?.epoch,revision=entry?.fromRevision}={}){
 if(!entry||entry.version!==1||entry.epoch!==epoch||entry.fromRevision!==revision||entry.toRevision!==revision+1)throw new Error('Checkpoint delta sequence mismatch');
 if(checkpointDigest(base)!==entry.baseDigest)throw new Error('Checkpoint delta base mismatch');
 const next=applyOps(base,entry.ops);if(checkpointDigest(next)!==entry.resultDigest)throw new Error('Checkpoint delta result mismatch');return next;
}
export function createCheckpointJournal({epoch=1,revision=0,checkpoint=null,maxEntries=24,maxBytes=900_000}={}){
 if(!Number.isSafeInteger(epoch)||epoch<1||!validRevision(revision))throw new Error('Invalid checkpoint journal');
 const current=checkpoint===null?null:clone(checkpoint);
 return{version:1,epoch,baseRevision:revision,baseCheckpoint:current===null?null:clone(current),baseDigest:current===null?null:checkpointDigest(current),latestRevision:revision,latestCheckpoint:current,entries:[],maxEntries,maxBytes};
}
export function rebaseCheckpointJournal(journal,{epoch,revision=journal?.latestRevision??0,checkpoint=journal?.latestCheckpoint??null}={}){
 return createCheckpointJournal({epoch,revision,checkpoint,maxEntries:journal?.maxEntries??24,maxBytes:journal?.maxBytes??900_000});
}
export function appendCheckpoint(journal,{epoch=journal?.epoch,revision,checkpoint}={}){
 if(!journal||journal.version!==1||epoch!==journal.epoch||checkpoint===null||checkpoint===undefined)throw new Error('Invalid checkpoint append');
 if(!validRevision(revision)||revision!==journal.latestRevision+1)throw new Error('Checkpoint revision gap');
 if(journal.latestCheckpoint===null){const next=createCheckpointJournal({epoch,revision,checkpoint,maxEntries:journal.maxEntries,maxBytes:journal.maxBytes});return{journal:next,entry:null,compacted:true};}
 const entry=createCheckpointDelta(journal.latestCheckpoint,checkpoint,{epoch,fromRevision:journal.latestRevision,toRevision:revision});
 let next={...journal,latestRevision:revision,latestCheckpoint:clone(checkpoint),entries:[...journal.entries,entry]};
 const journalBytes=bytes({entries:next.entries});
 if(next.entries.length>=next.maxEntries||journalBytes>=next.maxBytes){next=createCheckpointJournal({epoch,revision,checkpoint,maxEntries:next.maxEntries,maxBytes:next.maxBytes});return{journal:next,entry,compacted:true};}
 return{journal:next,entry,compacted:false};
}
function digestAt(journal,revision){if(revision===journal.baseRevision)return journal.baseDigest;const entry=journal.entries.find(item=>item.toRevision===revision);return entry?.resultDigest??null;}
export function createCatchupPayload(journal,knownRevision=0,knownDigest=null){
 if(!journal||journal.latestCheckpoint===null)return{version:1,kind:'none',epoch:journal?.epoch??0,revision:journal?.latestRevision??0};
 if(!validRevision(knownRevision)||knownRevision>journal.latestRevision)knownRevision=0;
 const retainedDigest=digestAt(journal,knownRevision);
 if(knownDigest&&retainedDigest!==knownDigest)return fullPayload(journal);
 if(knownRevision===journal.latestRevision)return{version:1,kind:'none',epoch:journal.epoch,revision:journal.latestRevision,digest:checkpointDigest(journal.latestCheckpoint)};
 const canDelta=knownRevision>=journal.baseRevision&&retainedDigest!==null;
 if(canDelta){const entries=journal.entries.filter(item=>item.toRevision>knownRevision);let cursor=knownRevision;for(const entry of entries){if(entry.fromRevision!==cursor)return fullPayload(journal);cursor=entry.toRevision;}if(cursor===journal.latestRevision)return{version:1,kind:'delta',epoch:journal.epoch,baseRevision:knownRevision,baseDigest:retainedDigest,revision:journal.latestRevision,resultDigest:checkpointDigest(journal.latestCheckpoint),entries:clone(entries)};}
 return fullPayload(journal);
}
function fullPayload(journal){return{version:1,kind:'full',epoch:journal.epoch,revision:journal.latestRevision,digest:checkpointDigest(journal.latestCheckpoint),checkpoint:clone(journal.latestCheckpoint)};}
export function applyCatchupPayload(current,{revision=0}={},payload){
 if(!payload||payload.version!==1)throw new Error('Invalid checkpoint catch-up');
 if(payload.kind==='none'){if(payload.revision!==revision)throw new Error('Checkpoint catch-up revision mismatch');if(current!==null&&payload.digest&&checkpointDigest(current)!==payload.digest)throw new Error('Checkpoint catch-up digest mismatch');return{checkpoint:current===null?null:clone(current),revision};}
 if(payload.kind==='full'){if(checkpointDigest(payload.checkpoint)!==payload.digest)throw new Error('Checkpoint full digest mismatch');return{checkpoint:clone(payload.checkpoint),revision:payload.revision};}
 if(payload.kind!=='delta'||current===null||payload.baseRevision!==revision||checkpointDigest(current)!==payload.baseDigest)throw new Error('Checkpoint catch-up base mismatch');
 let checkpoint=clone(current),cursor=revision;
 for(const entry of payload.entries||[]){checkpoint=applyCheckpointDelta(checkpoint,entry,{epoch:payload.epoch,revision:cursor});cursor=entry.toRevision;}
 if(cursor!==payload.revision||checkpointDigest(checkpoint)!==payload.resultDigest)throw new Error('Checkpoint catch-up result mismatch');
 return{checkpoint,revision:cursor};
}
export function checkpointJournalDiagnostics(journal){return Object.freeze({epoch:journal?.epoch??0,baseRevision:journal?.baseRevision??0,latestRevision:journal?.latestRevision??0,entries:journal?.entries?.length??0,journalBytes:bytes({entries:journal?.entries||[]}),fullBytes:journal?.latestCheckpoint===null?0:bytes(journal.latestCheckpoint)});}
