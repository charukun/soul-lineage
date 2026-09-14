import {subscribe} from './view-state.js';
const root=document.querySelector('#shared-world');
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const age=value=>{const ms=Date.now()-Date.parse(value||'');if(!Number.isFinite(ms))return'未記録';if(ms<60000)return`${Math.max(0,Math.floor(ms/1000))}秒前`;return`${Math.floor(ms/60000)}分前`;};
function metric(label,value,tone=''){const box=node('div',`world-metric ${tone}`);box.append(node('small','',label),node('strong','',value));return box;}
function render(data){if(!root)return;root.replaceChildren();if(!data?.available){root.append(node('p','empty','共通世界の運用状態はまだありません'));return;}
 const c=data.counts||{};const summary=node('div','world-summary');summary.append(metric('公開中',c.open??0,'ok'),metric('移行中',c.migrating??0,c.migrating?'warning':''),metric('接続端末',c.peers??0),metric('SLO超過',c.sloViolations??0,c.sloViolations?'danger':'ok'));root.append(summary);
 const rooms=node('div','world-rooms');if(!data.rooms?.length)rooms.append(node('p','empty','現在公開中の共通村はありません'));
 for(const room of data.rooms||[]){const card=node('article',`world-room phase-${room.phase}`);const head=node('div','world-room-head');head.append(node('strong','',room.label||room.worldId),node('span',`badge ${room.phase==='open'?'ok':room.phase==='migrating'?'warning':'danger'}`,room.phase==='open'?'OPEN':room.phase==='migrating'?'MIGRATING':'CLOSED'));card.append(head);
  const grid=node('div','world-room-grid');grid.append(metric('Host',`${room.hostRef||'-'}${room.hostScore===null||room.hostScore===undefined?'':` · ${room.hostScore}`}`),metric('Peers',room.peers??0),metric('Epoch',room.epoch??0),metric('Checkpoint',`rev ${room.checkpointRevision??0}`));card.append(grid);
  const q=room.quorum?`Quorum ≥${room.quorum.acked}/${room.quorum.total}`:'Quorum 未記録';const migration=room.lastMigrationMs===null?`Migration 未記録`:`Migration ${room.lastMigrationMs}ms`;const detection=room.detectionMs===null?'':` · Detection ${room.detectionMs}ms`;card.append(node('p',room.sloPass===false?'world-note danger':'world-note',`${q} · ${migration}${detection} · split-brain防止 ${room.splitBrainPrevented??0}回 · ${age(room.updatedAt)}`));rooms.append(card);
 }root.append(rooms);
}
subscribe(state=>render(state?.sharedWorld));
