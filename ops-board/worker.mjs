import { OPS_BUILD_SHA as BUNDLED_BUILD_SHA } from './build-info.mjs';
import { DurableObject } from 'cloudflare:workers';
import { buildState } from './collector.mjs';
import { readStored, writeStored } from './github-client.mjs';
import { degradedState } from './fallback-state.mjs';
import { boardAlerts } from './public/health.mjs';
import { buildApplications } from './applications.mjs';
import { appendControlHistory, deriveControlTower, publicControlHistory } from './control-tower.mjs';
import {
  PEER_WORLD_REGISTRY_KEY,emptyPeerWorldRegistry,createPeerWorldRoom,listPeerWorldRooms,joinPeerWorldRoom,
  readHostEvents,postPeerWorldOffer,readGuestEvents,postPeerWorldAnswer,updatePeerWorldTelemetry,
  deletePeerWorldRoom,publicPeerWorldSnapshot,
} from './peer-world-registry.mjs';
export { buildState } from './collector.mjs';
const PEER_CORS={
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'GET,POST,DELETE,OPTIONS',
  'access-control-allow-headers':'content-type,authorization',
  'access-control-max-age':'600',
};
function json(data, status = 200, extra = {}) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } }); }
function peerJson(data,status=200){return json(data,status,PEER_CORS);}
function buildCommit(env){return env.OPS_BUILD_SHA||BUNDLED_BUILD_SHA||null;}
function publicState(state, env) { return state ? { ...state, buildCommit: buildCommit(env), alerts: boardAlerts(state) } : state; }
const bearer=request=>{const value=request.headers.get('authorization')||'';return value.startsWith('Bearer ')?value.slice(7):'';};
async function peerBody(request,max=110000){const text=await request.text();if(text.length>max)throw new Error('payload_too_large');return text?JSON.parse(text):{};}
function peerErrorStatus(message){return message==='unauthorized'?401:message==='room_not_found'||message==='join_not_found'?404:message==='room_limit'||message==='join_limit'?429:400;}
const EVENT_REASONS = new Set(['prime', 'pr-event', 'integration', 'deployment']);
function eventReason(request) {
  const reason = (request.headers.get('x-ops-refresh-reason') || '').trim().toLowerCase();
  return EVENT_REASONS.has(reason) ? `github-event:${reason}` : 'github-event';
}
function githubAuthError(source) {
  return Object.assign(new Error('github_auth_required'), {
    authRequired: true,
    githubDiagnostic: { kind: 'auth-required', status: null, scope: 'none', source },
  });
}
function opsStateStub(env) {
  const namespace = env?.OPS_STATE;
  if (!namespace) throw new Error('ops_state_binding_missing');
  if (typeof namespace.idFromName === 'function' && typeof namespace.get === 'function') {
    return namespace.get(namespace.idFromName('global'));
  }
  if (typeof namespace.getByName === 'function') return namespace.getByName('global');
  throw new Error('ops_state_binding_unavailable');
}
function emergencyState(error, source = 'state-read') {
  const attemptedAt = new Date().toISOString();
  const state = {
    repository: 'charukun/soul-lineage',
    schemaVersion: 2,
    generatedAt: null,
    lastAttemptAt: attemptedAt,
    syncStatus: 'degraded',
    syncSource: 'PULSE fallback',
    syncError: 'PULSEの状態取得を自動再試行しています',
    refreshReason: source,
    nextRetryAt: null,
    githubFailure: { kind: 'runtime', status: null, scope: 'none' },
    pullRequests: { normal: [], visualReview: [] },
    applications: buildApplications({}, [], [], { developSha:null, statuses:[] }),
    environments: [],
    environmentDiff: { count: null, label: '状態を再取得中', pulls: [] },
    integration: { phase: 'reconcile-wait', tone: 'info', queue: [] },
    recentActionFailures: [],
    actionHistory: [],
  };
  state.controlTower = deriveControlTower(state, null);
  return state;
}
async function resilientPublicState(error, env, source = 'state-read') {
  try {
    const state = await degradedState(null, error, { source });
    state.controlTower = deriveControlTower(state, null);
    return publicState(state, env);
  } catch {
    return publicState(emergencyState(error, source), env);
  }
}

function createMemoryStorage(map=new Map()) {
  return {
    async get(key){ return map.get(key); },
    async put(key,value){
      if (key && typeof key === 'object' && value === undefined) {
        for (const [entryKey,entryValue] of Object.entries(key)) map.set(entryKey,entryValue);
        return;
      }
      map.set(key,value);
    },
    async delete(key){ map.delete(key); },
  };
}

export class OpsState extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.inflight = null;
    this.memoryState = null;
    this.memoryHistory = { schema:1, snapshots:[], publications:[] };
    this.memoryRescue = null;
    this.refreshStorage = createMemoryStorage();
  }
  async getState() {
    return this.memoryState;
  }
  async getHistory() {
    return publicControlHistory(this.memoryHistory);
  }
  async recordHistory(state) {
    this.memoryHistory = appendControlHistory(this.memoryHistory, state);
    return publicControlHistory(this.memoryHistory);
  }
  async observeRescue(snapshot) {
    const previous = this.memoryRescue;
    if (!previous || Date.parse(snapshot.generatedAt) > Date.parse(previous.generatedAt)) {
      this.memoryRescue = snapshot;
      const current = await this.getState();
      if (current) {
        const state = { ...current, integrationRescue: snapshot };
        state.controlTower = deriveControlTower(state, current.controlTower);
        this.memoryState = state;
        await this.recordHistory(state);
      }
    }
    return { accepted: true };
  }
  async peerRegistry(){return await readStored(this.ctx.storage,PEER_WORLD_REGISTRY_KEY)||emptyPeerWorldRegistry();}
  async peerApply(operation,...args){const current=await this.peerRegistry();const {state,result}=operation(current,...args,Date.now());await writeStored(this.ctx.storage,PEER_WORLD_REGISTRY_KEY,state);return result;}
  async peerSnapshot(){return publicPeerWorldSnapshot(await this.peerRegistry(),Date.now());}
  async peerList(){return this.peerApply(listPeerWorldRooms);}
  async peerCreate(input){return this.peerApply(createPeerWorldRoom,input);}
  async peerJoin(roomId,input,token){return this.peerApply(joinPeerWorldRoom,roomId,{...input,inviteToken:token});}
  async peerHostEvents(roomId,token,after){return this.peerApply(readHostEvents,roomId,token,after);}
  async peerOffer(roomId,joinId,token,offer){return this.peerApply(postPeerWorldOffer,roomId,joinId,token,offer);}
  async peerGuestEvents(roomId,joinId,token,after){return this.peerApply(readGuestEvents,roomId,joinId,token,after);}
  async peerAnswer(roomId,joinId,token,answer){return this.peerApply(postPeerWorldAnswer,roomId,joinId,token,answer);}
  async peerTelemetry(roomId,token,input){return this.peerApply(updatePeerWorldTelemetry,roomId,token,input);}
  async peerDelete(roomId,token){return this.peerApply(deletePeerWorldRoom,roomId,token);}
  async refresh(source = 'manual', requestToken = '') {
    if (this.inflight) return this.inflight;
    const token = (requestToken || this.env.OPS_GITHUB_TOKEN || '').trim();
    if (!token) throw githubAuthError(source);
    this.inflight = (async () => {
      let previous = null;
      try {
        previous = this.memoryState;
        const state = await buildState(previous, { storage: this.refreshStorage, token, reason: source });
        state.refreshReason = source;
        state.nextRetryAt = null;
        state.controlTower = deriveControlTower(state, previous?.controlTower);
        this.memoryState = state;
        await this.recordHistory(state);
        return state;
      } catch (error) {
        const state = await degradedState(previous, error, { source });
        state.controlTower = deriveControlTower(state, previous?.controlTower);
        this.memoryState = state;
        await this.recordHistory(state);
        return state;
      } finally { this.inflight = null; }
    })();
    return this.inflight;
  }
  async alarm() {
    if (!this.env.OPS_GITHUB_TOKEN) return;
    await this.refresh('rate-limit-retry');
  }
}
function authorized(request, env) { return Boolean(env.OPS_REFRESH_TOKEN) && request.headers.get('authorization') === `Bearer ${env.OPS_REFRESH_TOKEN}`; }
function authorizedRefresh(request, env) {
  if (authorized(request, env)) return true;
  const auth=bearer(request), github=(request.headers.get('x-ops-github-token')||'').trim();
  return github.length>=20 && github.length<=1024 && auth===github;
}
async function handlePeerWorld(request,url,stub){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:PEER_CORS});
  const segments=url.pathname.split('/').filter(Boolean); // api, peer-world, rooms, ...
  try{
    if(segments.length===3&&segments[2]==='rooms'){
      if(request.method==='GET')return peerJson(await stub.peerList());
      if(request.method==='POST')return peerJson(await stub.peerCreate(await peerBody(request)),201);
    }
    if(segments[2]!=='rooms'||!segments[3])return peerJson({error:'not_found'},404);
    const roomId=segments[3],token=bearer(request);
    if(segments.length===4&&request.method==='DELETE')return peerJson(await stub.peerDelete(roomId,token));
    if(segments[4]==='join'&&segments.length===5&&request.method==='POST')return peerJson(await stub.peerJoin(roomId,await peerBody(request),token),201);
    if(segments[4]==='host-events'&&request.method==='GET')return peerJson(await stub.peerHostEvents(roomId,token,Number(url.searchParams.get('after')||0)));
    if(segments[4]==='telemetry'&&request.method==='POST')return peerJson(await stub.peerTelemetry(roomId,token,await peerBody(request)));
    if(segments[4]==='joins'&&segments[5]){
      const joinId=segments[5];
      if(segments[6]==='offer'&&request.method==='POST'){const body=await peerBody(request);return peerJson(await stub.peerOffer(roomId,joinId,token,body.offer));}
      if(segments[6]==='events'&&request.method==='GET')return peerJson(await stub.peerGuestEvents(roomId,joinId,token,Number(url.searchParams.get('after')||0)));
      if(segments[6]==='answer'&&request.method==='POST'){const body=await peerBody(request);return peerJson(await stub.peerAnswer(roomId,joinId,token,body.answer));}
    }
    return peerJson({error:'not_found'},404);
  }catch(error){return peerJson({error:String(error?.message||'peer_world_error')},peerErrorStatus(error?.message));}
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if(url.pathname.startsWith('/api/peer-world/'))return handlePeerWorld(request,url,opsStateStub(env));
      if (url.pathname === '/api/version' && request.method === 'GET') return json({ app: 'ops-board', commit: buildCommit(env) });
      if (url.pathname === '/api/state' && request.method === 'GET') {
        try {
          const stub = opsStateStub(env);
          let state = await stub.getState();
          if (!state && env.OPS_GITHUB_TOKEN) state = await stub.refresh('cold-start');
          if (!state) return json(await resilientPublicState(githubAuthError('state-read'), env, 'state-read'));
          const history = await stub.getHistory();
          let sharedWorld = null;
          try { sharedWorld = await stub.peerSnapshot(); } catch { /* peer persistence must not poison PULSE state */ }
          return json({ ...publicState(state, env), history, sharedWorld });
        } catch (error) {
          return json({ ...(await resilientPublicState(error, env, 'state-read')), history: { schema:1, snapshots:[], publications:[] }, sharedWorld: null, runtimeFallback: true });
        }
      }
      if (url.pathname === '/api/history' && request.method === 'GET') {
        try { return json(await opsStateStub(env).getHistory()); }
        catch { return json({ schema:1, snapshots:[], publications:[] }); }
      }
      if (url.pathname === '/api/refresh' && request.method === 'POST') {
        if (!authorizedRefresh(request, env)) return json({ error: 'unauthorized' }, 401);
        const token = (request.headers.get('x-ops-github-token') || '').trim();
        if (token.length > 1024) return json({ error: 'invalid_credential' }, 400);
        if (!token && !env.OPS_GITHUB_TOKEN) return json({ error: 'github_auth_required' }, 503);
        try {
          const stub = opsStateStub(env);
          return json(publicState(await stub.refresh(eventReason(request), token), env));
        } catch (error) {
          return json({ ...(await resilientPublicState(error, env, eventReason(request))), refreshFailed: true, refreshError: 'state_unavailable' });
        }
      }
      if (url.pathname === '/api/rescue-observation' && request.method === 'POST') {
        if (!authorized(request, env)) return json({ error: 'unauthorized' }, 401);
        const body = await request.text();
        if (body.length > 900000) return json({ error: 'snapshot_too_large' }, 413);
        const snapshot = JSON.parse(body);
        if (!snapshot.available || !Number.isFinite(Date.parse(snapshot.generatedAt)) || !Array.isArray(snapshot.workers) || !Array.isArray(snapshot.queue)) return json({ error: 'invalid_snapshot' }, 400);
        return json(await opsStateStub(env).observeRescue(snapshot));
      }
      if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
      return env.ASSETS.fetch(request);
    } catch { return json({ error: 'state_unavailable' }, 503); }
  },
  async scheduled(controller, env, ctx) {
    if (!env.OPS_GITHUB_TOKEN) return;
    ctx.waitUntil(opsStateStub(env).refresh(`cron:${controller.cron}`));
  },
};
