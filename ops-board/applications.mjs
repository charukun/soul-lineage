import { GAME_ENVIRONMENTS, PULSE_SURFACES } from '../scripts/application-catalog.mjs';
import { distributionPublicUrl } from '../scripts/distribution-targets.mjs';

export const OPS_PUBLIC_URL = 'https://rinne-ops.c-okamoto.workers.dev/';
export const PORTAL_PUBLIC_URL = 'https://wayfinder-gallery.c-okamoto.workers.dev/';
const PAGES_ROOT = 'https://charukun.github.io/soul-lineage/';
const environmentIds = new Set(GAME_ENVIRONMENTS.map(env => env.id));
const validApp = id => typeof id === 'string' && /^[a-z][a-z0-9-]*$/.test(id);

const runState = run => {
  if (!run) return 'unknown';
  if (['queued', 'in_progress', 'waiting', 'requested', 'pending'].includes(run.status)) return 'deploying';
  if (run.status === 'completed' && run.conclusion === 'success') return 'success';
  if (run.status === 'completed' && ['failure', 'timed_out', 'action_required', 'startup_failure', 'stale'].includes(run.conclusion)) return 'failed';
  return 'unknown';
};

function targetFor(app, definition, entries, environment, manifest) {
  const matches = entries.filter(entry => entry.app === app && entry.environment === definition.id);
  const base = { id: `${definition.id}:${app}`, label: definition.label, environment: definition.id,
    expectedUrl: `${PAGES_ROOT}${definition.id}/${app}/`, source: '公開manifest' };
  if (!matches.length) return { ...base, state: 'missing', url: null, commit: null, deployedAt: null,
    note: '公開manifestに登録がありません。URLを推測して公開中とは表示しません。' };
  const entry = matches[0];
  const validPath = entry.path === `${definition.id}/${app}` || (app === 'rinne' && definition.id === 'prod' && entry.path === 'prod');
  if (matches.length !== 1 || !validPath || !entry.version?.commit) return { ...base, state: 'unknown', url: null,
    commit: null, deployedAt: null, note: '公開情報が重複、欠損、または想定外のパスです。' };
  // A pending/failed newer release does not erase the version actually serving.
  // A mixed-source production environment also must not hide per-app publication.
  return { ...base, state: 'success', url: `${PAGES_ROOT}${entry.path}/`, commit: entry.version.commit,
    deployedAt: entry.deployedAt || manifest.environmentSnapshots?.[definition.id]?.deployedAt || environment?.deployedAt || null,
    updateState: environment?.deployState || null,
    publishedName: entry.version.name || null,
  };
}

function fastDevTarget(app,developSha,statuses=[]){
  const status=(statuses||[]).find(row=>row.context===`dev/${app}`)||null;
  const state=status?.state==='success'?'success':status?.state==='pending'?'deploying':['failure','error'].includes(status?.state)?'failed':'unknown';
  return {id:`fast-dev:${app}`,label:'高速DEV',environment:'dev',state,url:distributionPublicUrl('web-dev',app),
    expectedUrl:distributionPublicUrl('web-dev',app),commit:status?.state==='success'?developSha:null,
    deployedAt:status?.updated_at||status?.created_at||null,source:'per-app DEV / exact-source status',
    note:status?'app単位で独立公開':'公開status同期待ち'};
}

export function buildApplications(manifest = {}, environments = [], runs = [], { developSha = null, statuses = [] } = {}) {
  const environmentById = new Map(environments.map(env => [env.id, env]));
  const entries = (manifest.entries || []).filter(entry => validApp(entry?.app) && environmentIds.has(entry.environment));
  const groups = new Map();

  for (const surface of PULSE_SURFACES) {
    if (surface.kind === 'external') continue;
    const dev = fastDevTarget(surface.deployApp, developSha, statuses);
    if (surface.id === 'ops-board') {
      groups.set(surface.id, {
        id:surface.id, name:surface.displayName, kind:surface.kind,
        targets:[{ ...dev, id:'ops-board', label:'この画面' }],
      });
      continue;
    }
    if (surface.kind === 'game') {
      groups.set(surface.id, {
        id:surface.id, name:surface.displayName, kind:surface.kind,
        targets:[dev, ...GAME_ENVIRONMENTS.filter(definition => definition.id !== 'dev')
          .map(definition => targetFor(surface.id, definition, entries, environmentById.get(definition.id), manifest))],
      });
      continue;
    }
    groups.set(surface.id, {
      id:surface.id, name:surface.displayName, kind:surface.kind, targets:[dev],
    });
  }

  const portalSurface = PULSE_SURFACES.find(surface => surface.id === 'portal');
  const portalRun = runs.find(run => run.name === 'Wayfinder Public Gallery') || null;
  groups.set('portal', { id:'portal', name:portalSurface?.displayName || 'WAYFINDER', kind:'external', targets:[{
    id:'portal', label:'一般公開', environment:'tool', state:runState(portalRun), url:PORTAL_PUBLIC_URL,
    commit:portalRun?.head_sha || null, deployedAt:portalRun?.updated_at || null, source:'Wayfinder Public Gallery workflow',
  }] });

  for (const env of environments.filter(item => item.kind === 'preview')) {
    const id = `preview:${env.id}`;
    groups.set(id, {
      id, name:env.name || env.workflow || env.id || 'Preview', kind:'preview',
      targets:[{ id:env.id, label:'専用公開', environment:'preview', state:env.deployState || 'unknown',
        url:env.url || null, commit:env.deployedCommit || null, deployedAt:env.deployedAt || null,
        source:'GitHub Actions / 公開status' }],
    });
  }

  const order = PULSE_SURFACES.map(surface => surface.id);
  return [...groups.values()].sort((a,b) => {
    const ai=order.indexOf(a.id), bi=order.indexOf(b.id);
    return (ai===-1?99:ai)-(bi===-1?99:bi) || String(a.name||a.id).localeCompare(String(b.name||b.id),'ja');
  });
}
