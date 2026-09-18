import {createPeerHostedWorldNode} from '../packages/network/src/peer-hosted-world.js';

const checkpoint=value=>({schemaVersion:1,worldTimeMs:value,world:{value},characters:[],npcs:[],randomState:value,session:null});
let time=0,seq=0;
const wire=[],nodes={},applied={},history=[];
const ids=['a','b','c','d'];
const eligibility={a:true,b:true,c:true,d:false};
for(const id of ids)nodes[id]=createPeerHostedWorldNode({selfId:id,worldId:'chaos-village',mayorId:'a',hostEligible:eligibility[id],now:()=>time,timings:{hostLeaseMs:900,migrationTimeoutMs:1800},emit:event=>wire.push({id:++seq,from:id,deliverAt:time+35+(seq%4)*12,...event}),applyCheckpoint:value=>{applied[id]=value.world.value;},onPhase:info=>history.push({time,id,...info})});
function pump({partitionHost=false,lossModulo=0}={}){wire.sort((a,b)=>a.deliverAt-b.deliverAt||a.id-b.id);let progress=true,guard=0;while(progress&&guard++<2000){progress=false;for(let i=0;i<wire.length;i++){const e=wire[i];if(e.deliverAt>time)continue;wire.splice(i--,1);progress=true;if(partitionHost&&(e.from==='a'||e.to==='a'))continue;if(lossModulo&&e.id%lossModulo===0&&e.message?.type==='world-heartbeat')continue;if(e.to)nodes[e.to]?.receive(e.from,e.message);else for(const id of ids)if(id!==e.from)nodes[id].receive(e.from,e.message);}}if(guard>=2000)throw Error('chaos network did not settle');}
function advance(ms,options){time+=ms;for(const node of Object.values(nodes))node.tick();pump(options);}
function assert(condition,message){if(!condition)throw Error(message);}

nodes.a.seedHost();nodes.a.hostAdmit('b',{eligible:true,meta:{app:'village'}});nodes.a.hostAdmit('c',{eligible:true,meta:{app:'village'}});nodes.a.hostAdmit('d',{eligible:false,meta:{app:'demon'}});nodes.a.publishCheckpoint(checkpoint(101));
for(let i=0;i<12;i++)advance(100,{lossModulo:7});
assert(nodes.a.snapshot().phase==='open','healthy host lost authority under bounded delay/loss');
for(let i=0;i<14;i++)advance(100,{partitionHost:true});
assert(nodes.b.snapshot().hostId==='b'&&nodes.b.snapshot().phase==='open','eligible successor did not take authority');
assert(nodes.c.snapshot().hostId==='b','survivor did not accept successor proof');
assert(nodes.d.snapshot().hostId==='b','non-host peer did not follow successor');
assert(applied.b===101,'successor did not apply latest checkpoint');
for(let i=0;i<12;i++)advance(100);
assert(nodes.a.snapshot().hostId==='b'&&nodes.a.snapshot().phase==='open','returning old host did not resynchronize');
assert(nodes.a.snapshot().epoch===nodes.b.snapshot().epoch,'returning host epoch differs after resync');

const report={ok:true,finishedAtMs:time,host:nodes.b.snapshot().hostId,epoch:nodes.b.snapshot().epoch,checkpoint:nodes.b.snapshot().checkpointRevision,applied,phaseTransitions:history.length,history:history.slice(-20)};
console.log(JSON.stringify(report,null,2));
