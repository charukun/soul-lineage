import { GAME_NAMES, GAME_ENVIRONMENTS, BOARD_NAME } from '../scripts/application-catalog.mjs';
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
  const state=status?.state==='success'?'success':status?.state==='pending'?'deploying':['failure','error'].includes(status?.state)?'failed':'waiting';
  return {id:`fast-dev:${app}`,label:'高速DEV',environment:'dev-fast',state,url:distributionPublicUrl('web-dev',app),
    expectedUrl:distributionPublicUrl('web-dev',app),commit:status?.state==='success'?developSha:null,
    deployedAt:status?.updated_at||status?.created_at||null,source:'per-app DEV / exact-source status',
    note:status?'app単位で独立公開':'公開status同期待ち'};
}

export function buildApplications(manifest = {}, environments = [], runs = [], { developSha = null, statuses = [] } = {}) {
  const environmentById = new Map(environments.map(env => [env.id, env]));
  const entries = (manifest.entries || []).filter(entry => validApp(entry?.app) && environmentIds.has(entry.environment));
  const ids = new Set([...Object.keys(GAME_NAMES), ...entries.map(entry => entry.app)]);
  const groups = new Map([...ids].map(id => [id, {
    id, name: GAME_NAMES[id] || entries.find(entry => entry.app === id)?.version?.name || id, kind: 'game',
    targets: [fastDevTarget(id,developSha,statuses),...GAME_ENVIRONMENTS.map(definition => targetFor(id, definition, entries, environmentById.get(definition.id), manifest))],
  }]));

  groups.set('character-studio', {
    id: 'character-studio', name: 'キャラクター工房', kind: 'tool',
    targets: [fastDevTarget('character-studio', developSha, statuses)],
  });
  groups.set('visual-review', {
    id: 'visual-review', name: 'Visual Review Lab', kind: 'tool',
    targets: [fastDevTarget('review', developSha, statuses)],
  });

  for (const env of environments.filter(item => item.kind === 'preview')) {
    const id = `preview:${env.id}`;
    groups.set(id, {
      id, name: env.name, kind: 'tool',
      targets: [{ id: env.id, label: '専用公開', environment: 'preview', state: env.deployState || 'unknown',
        url: env.url || null, commit: env.deployedCommit || null, deployedAt: env.deployedAt || null,
        source: 'GitHub Actions / 公開status' }],
    });
  }

  const portalRun = runs.find(run => run.name === 'Wayfinder Public Gallery') || null;
  groups.set('portal', { id: 'portal', name: 'WAYFINDER', kind: 'tool', targets: [{
    id: 'portal', label: '一般公開', environment: 'tool', state: runState(portalRun), url: PORTAL_PUBLIC_URL,
    commit: portalRun?.head_sha || null, deployedAt: portalRun?.updated_at || null, source: 'Wayfinder Public Gallery workflow',
  }] });
  // Keep the workflow/Worker IDs stable; they are machine-facing integration keys.
  const opsRun = runs.find(run => run.name === 'Rinne Ops Board' && run.head_branch === 'develop') || null;
  groups.set('ops-board', { id: 'ops-board', name: BOARD_NAME, kind: 'tool', targets: [{
    id: 'ops-board', label: 'この画面', environment: 'tool', state: runState(opsRun), url: OPS_PUBLIC_URL,
    commit: opsRun?.head_sha || null, deployedAt: opsRun?.updated_at || null, source: 'Rinne Ops Board workflow',
  }] });

  const lanternRun = runs.find(run => /^Lanternfell (night portrait DEV|isolated preview check)$/i.test(run.name || '')) || null;
  if (lanternRun && !groups.has('lanternfell')) groups.set('lanternfell', {
    id: 'lanternfell', name: 'Lanternfell / Tidebreak', kind: 'preview',
    targets: [{ id: 'lanternfell-preview', label: '専用開発版', environment: 'preview', state: runState(lanternRun),
      url: null, commit: lanternRun.head_sha || null, deployedAt: lanternRun.updated_at || null,
      source: 'Lanternfell dedicated workflow', note: runState(lanternRun) === 'failed'
        ? '専用公開処理が失敗中。公開URLは確認できるまで表示しません。' : '専用公開URLの検証結果を確認中です。' }],
  });
  const order = ['rinne', 'village', 'demon', 'lanternfell', 'character-studio', 'visual-review', 'portal', 'ops-board'];
  return [...groups.values()].sort((a, b) => {
    const ai = order.indexOf(a.id); const bi = order.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.name.localeCompare(b.name, 'ja');
  });
}
