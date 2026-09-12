export const OPS_PUBLIC_URL = 'https://rinne-ops.c-okamoto.workers.dev/';
export const PORTAL_PUBLIC_URL = 'https://wayfinder-gallery.c-okamoto.workers.dev/';

const displayNames = {
  rinne: '輪廻転焦',
  village: 'MURAAAAAAA（村づくり）',
  demon: '暗い喰らいCry（魔物側）',
  lanternfell: 'Lanternfell / Tidebreak',
};

const runState = run => {
  if (!run) return 'unknown';
  if (['queued', 'in_progress', 'waiting', 'requested', 'pending'].includes(run.status)) return 'deploying';
  if (run.status === 'completed' && run.conclusion === 'success') return 'success';
  if (run.status === 'completed' && ['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure', 'stale'].includes(run.conclusion)) return 'failed';
  return 'unknown';
};

function targetFromEntry(entry, environment) {
  return {
    id: `${entry.environment}:${entry.app}`,
    label: entry.environment === 'dev' ? '開発版' : '本番版',
    environment: entry.environment,
    state: environment?.deployState || 'unknown',
    url: `https://charukun.github.io/soul-lineage/${entry.path}/`,
    commit: entry.version?.commit || null,
    deployedAt: environment?.deployedAt || null,
    source: '公開manifest',
  };
}

export function buildApplications(manifest = {}, environments = [], runs = []) {
  const environmentById = new Map(environments.map(env => [env.id, env]));
  const groups = new Map();

  for (const entry of manifest.entries || []) {
    if (!entry?.app || !entry?.path || !['dev', 'prod'].includes(entry.environment)) continue;
    if (!groups.has(entry.app)) {
      groups.set(entry.app, {
        id: entry.app,
        name: entry.version?.name || displayNames[entry.app] || entry.app,
        kind: 'game',
        targets: [],
      });
    }
    groups.get(entry.app).targets.push(targetFromEntry(entry, environmentById.get(entry.environment)));
  }

  for (const env of environments.filter(item => item.kind === 'preview')) {
    const id = env.id === 'visual-review' ? 'visual-review' : `preview:${env.id}`;
    groups.set(id, {
      id,
      name: env.id === 'visual-review' ? 'Visual Review Lab（見た目確認）' : env.name,
      kind: 'tool',
      targets: [{
        id: env.id,
        label: '専用公開',
        environment: 'preview',
        state: env.deployState || 'unknown',
        url: env.url || null,
        commit: env.deployedCommit || null,
        deployedAt: env.deployedAt || null,
        source: 'GitHub Actions / 公開status',
      }],
    });
  }

  const portalRun = runs.find(run => run.name === 'Wayfinder Public Gallery') || null;
  groups.set('portal', {
    id: 'portal',
    name: 'WAYFINDER（公開リンクギャラリー）',
    kind: 'tool',
    targets: [{
      id: 'portal',
      label: '一般公開',
      environment: 'tool',
      state: runState(portalRun),
      url: PORTAL_PUBLIC_URL,
      commit: portalRun?.head_sha || null,
      deployedAt: portalRun?.updated_at || null,
      source: 'Wayfinder Public Gallery workflow',
    }],
  });

  const opsRun = runs.find(run => run.name === 'Rinne Ops Board') || null;
  groups.set('ops-board', {
    id: 'ops-board',
    name: '開発状況ボード',
    kind: 'tool',
    targets: [{
      id: 'ops-board',
      label: 'この画面',
      environment: 'tool',
      state: runState(opsRun),
      url: OPS_PUBLIC_URL,
      commit: opsRun?.head_sha || null,
      deployedAt: opsRun?.updated_at || null,
      source: 'Rinne Ops Board workflow',
    }],
  });

  const lanternRun = runs.find(run => /^Lanternfell (night portrait DEV|isolated preview check)$/i.test(run.name || '')) || null;
  if (lanternRun && !groups.has('lanternfell')) {
    groups.set('lanternfell', {
      id: 'lanternfell',
      name: displayNames.lanternfell,
      kind: 'preview',
      targets: [{
        id: 'lanternfell-preview',
        label: '専用開発版',
        environment: 'preview',
        state: runState(lanternRun),
        url: null,
        commit: lanternRun.head_sha || null,
        deployedAt: lanternRun.updated_at || null,
        source: 'Lanternfell dedicated workflow',
        note: runState(lanternRun) === 'failed'
          ? '専用公開処理が失敗中。公開URLは確認できるまで表示しません。'
          : '専用公開URLの検証結果を確認中です。',
      }],
    });
  }

  const order = ['rinne', 'village', 'demon', 'lanternfell', 'visual-review', 'portal', 'ops-board'];
  return [...groups.values()]
    .map(group => ({ ...group, targets: [...group.targets].sort((a, b) => (a.environment === 'prod' ? 1 : 0) - (b.environment === 'prod' ? 1 : 0)) }))
    .sort((a, b) => {
      const ai = order.indexOf(a.id); const bi = order.indexOf(b.id);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.name.localeCompare(b.name, 'ja');
    });
}
