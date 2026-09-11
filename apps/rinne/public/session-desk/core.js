/* Session Desk: data rules are independent from UI and network. */
(function (root) {
  'use strict';
  const VERSION = 1;
  const STATES = Object.freeze({unknown:'未確認',queued:'依頼待ち',running:'作業中との報告',waiting:'返答待ち',blocked:'問題あり',ready:'PR準備完了',completed:'完了との報告'});
  const MAX_SESSIONS = 10000;
  const clip = (v, max=300) => typeof v === 'string' ? v.slice(0,max) : '';
  function date(v) {
    if (v === null || v === undefined || v === '') return null;
    const d = new Date(typeof v === 'number' && v < 1e12 ? v*1000 : v);
    return Number.isFinite(d.getTime()) && d.getTime() > 0 ? d.toISOString() : null;
  }
  function chatUrl(v) {
    try { const u = new URL(v); return u.protocol==='https:' && u.hostname==='chatgpt.com' && !u.username && !u.password && /^\/(?:c\/[a-zA-Z0-9-]+|g\/[a-zA-Z0-9-]+\/c\/[a-zA-Z0-9-]+)\/?$/.test(u.pathname) ? u.origin+u.pathname : ''; } catch { return ''; }
  }
  function repo(v) { const s=clip(v,160).trim(); return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/.test(s) && !s.endsWith('/.') && !s.endsWith('/..') ? s : ''; }
  function normalize(s, origin='manual') {
    if (!s || typeof s!=='object' || Array.isArray(s)) throw new Error('セッションの形式が正しくありません。');
    const url=chatUrl(s.url || s.chatUrl);
    const id=clip(s.id || s.conversation_id || '',180);
    if (!id) throw new Error('セッションIDがありません。');
    const reportedAt=date(s.reportedAt);
    const declaredStatus=Object.hasOwn(STATES,s.status) && reportedAt ? s.status : 'unknown';
    return {id,title:clip(s.title,240)||'名称未設定',project:clip(s.project,120)||'所属未確認',location:['WORK','Chat','Codex'].includes(s.location)?s.location:'種別未確認',url,status:declaredStatus,reportedAt,updatedAt:date(s.updatedAt),source:['manual','export','work-report'].includes(origin)?origin:'manual',archived:!!s.archived,note:clip(s.note,2000)};
  }
  function fromExport(input) {
    const list=Array.isArray(input)?input:input?.conversations;
    if(!Array.isArray(list)) throw new Error('ChatGPTのconversations.jsonが見つかりません。');
    if(list.length>MAX_SESSIONS) throw new Error(`一度に読み込める会話は${MAX_SESSIONS}件までです。`);
    const out=[];
    for(const c of list) {
      if(!c || typeof c!=='object') continue;
      const id=clip(c.conversation_id||c.id,160);
      if(!/^[a-zA-Z0-9-]{8,160}$/.test(id)) continue;
      out.push(normalize({id:'chat:'+id,title:c.title,url:'https://chatgpt.com/c/'+id,project:clip(c.project_name,120)||(c.project_id?'Project '+clip(String(c.project_id),80):'所属未確認'),updatedAt:c.update_time||c.create_time,archived:c.is_archived,status:'unknown'},'export'));
    }
    if(!out.length && list.length) throw new Error('対応する会話IDがありません。ファイル形式を確認してください。');
    return out;
  }
  function mergeSessions(existing,incoming) {
    const m=new Map(existing.map(s=>[s.id,{...s}]));
    for(const item of incoming) {
      const old=m.get(item.id);
      if(!old){m.set(item.id,item);continue;}
      if(item.source==='export') {
        m.set(item.id,{...old,title:item.title,url:item.url||old.url,updatedAt:item.updatedAt||old.updatedAt,archived:item.archived,project:old.project==='所属未確認'?item.project:old.project});
      } else if (item.source==='manual' || !old.reportedAt || (item.reportedAt && new Date(item.reportedAt)>=new Date(old.reportedAt))) m.set(item.id,{...old,...item});
    }
    if(m.size>MAX_SESSIONS) throw new Error('登録件数の上限を超えています。');
    return [...m.values()];
  }
  function stale(s,now=Date.now()) { return ['running','waiting','blocked','ready'].includes(s.status) && (!s.reportedAt || now-new Date(s.reportedAt).getTime()>90*60000); }
  function stats(sessions,now=Date.now()) {
    const live=sessions.filter(s=>!s.archived);
    return {registered:live.length,runningReported:live.filter(s=>s.status==='running').length,attention:live.filter(s=>['unknown','blocked','waiting'].includes(s.status)||stale(s,now)).length,completedReported:live.filter(s=>s.status==='completed').length};
  }
  function taskText(request,session) {
    const role=request.role==='Integration'?'Integration':'WORK';
    const parts=[clip(request.text,10000).trim()];
    if(session) parts.push(`対象: ${session.title}\nProject: ${session.project}`);
    if(role==='Integration') parts.push('最新develop・既存Integrationルールを正本に、対象PRの検証・レビュー・統合・DEV反映を進めてください。main / Productionは変更しないでください。');
    else parts.push('最新develop・既存仕様とDEV高速開発ポリシーを正本に、実装・影響範囲の高速検証・Ready for review PR作成まで進めてください。merge・DEV公開はIntegrationへ引き継ぎ、main / Productionは変更しないでください。');
    parts.push('未実行・未確認のことは完了扱いにせず、作業状況と根拠を報告してください。');
    return parts.filter(Boolean).join('\n\n');
  }
  function githubSummary(pulls,runs) {
    return {openPRs:pulls.filter(p=>p.state==='open').length,drafts:pulls.filter(p=>p.state==='open'&&p.draft).length,runningCI:runs.filter(r=>r.status!=='completed').length,failedCI:runs.filter(r=>r.status==='completed'&&['failure','timed_out','startup_failure','action_required'].includes(r.conclusion)).length};
  }
  function empty() { return {schema:'session-desk/v1',sessions:[],tasks:[],settings:{repository:'charukun/soul-lineage'},github:null,exportImportedAt:null}; }
  function restore(data) {
    if(!data || data.schema!=='session-desk/v1' || !Array.isArray(data.sessions) || !Array.isArray(data.tasks)) throw new Error('Session Deskバックアップの形式が正しくありません。');
    if(data.sessions.length>MAX_SESSIONS || data.tasks.length>5000) throw new Error('データ件数の上限を超えています。');
    const out=empty();
    out.sessions=data.sessions.map(s=>normalize(s,s.source));
    out.tasks=data.tasks.filter(t=>t&&typeof t==='object').map(t=>({id:clip(t.id,180),text:clip(t.text,10000),prompt:clip(t.prompt,14000),sessionId:clip(t.sessionId,180),role:t.role==='Integration'?'Integration':'WORK',status:t.status==='sent-manual'?'sent-manual':'draft',createdAt:date(t.createdAt)||new Date().toISOString()}));
    out.settings.repository=repo(data.settings?.repository)||out.settings.repository;
    out.exportImportedAt=date(data.exportImportedAt);
    return out;
  }
  const api={VERSION,STATES,MAX_SESSIONS,clip,date,chatUrl,repo,normalize,fromExport,mergeSessions,stale,stats,taskText,githubSummary,empty,restore};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.DeskCore=Object.freeze(api);
})(globalThis);
