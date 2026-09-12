import { buildApplications } from './applications.mjs';
import { deploymentQueue, environmentDiff } from './model.mjs';
import { GAME_ENVIRONMENTS } from '../scripts/application-catalog.mjs';

// GitHub history is optional for displaying independently published game releases.
// Never turn a GitHub refresh error into a fake successful history refresh.
export function publishedFallback(previous, manifest, { now, error, source }) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.entries)) throw new Error('Invalid public deployment manifest');
  const oldEnvironments = previous?.environments || [];
  const environments = GAME_ENVIRONMENTS.map(definition => {
    const old = oldEnvironments.find(item => item.id === definition.id);
    const entries = manifest.entries.filter(entry => entry.environment === definition.id);
    const snapshot = manifest.environmentSnapshots?.[definition.id];
    const commits = [...new Set(entries.map(entry => entry.version?.commit).filter(Boolean))];
    const commit = snapshot?.commit || (commits.length === 1 ? commits[0] : null);
    const same = Boolean(commit && old?.deployedCommit === commit);
    const cachedHistory = same && Array.isArray(old.reflectedPrs);
    return {
      ...old, id: definition.id, kind: 'pages', name: { dev: 'DEV', staging: 'STAGING / 検証', prod: 'Production' }[definition.id],
      branch: snapshot?.branch || definition.branch, branchCommit: null,
      deployedCommit: commit, sourceCommits: commits, deployedAt: snapshot?.deployedAt || null,
      url: entries.length ? `https://charukun.github.io/soul-lineage/${definition.id}/` : null,
      deployState: commit ? 'success' : 'unknown', latestRun: null,
      source: '公開manifest（GitHub履歴の更新は失敗中）', exactCommit: Boolean(commit),
      // null means not fetched, unlike a fetched empty history. This lets the normal
      // refresh recover history after GitHub becomes available, at the same SHA.
      reflectedPrs: cachedHistory ? old.reflectedPrs : null,
      reflectedPrCount: cachedHistory ? (old.reflectedPrCount ?? null) : null,
      historyComplete: cachedHistory ? Boolean(old.historyComplete) : false,
      commitCountScanned: cachedHistory ? (old.commitCountScanned || 0) : 0,
      deployQueue: deploymentQueue(null),
    };
  });
  environments.push(...oldEnvironments.filter(item => item.kind === 'preview'));
  const oldApps = new Map((previous?.applications || []).map(app => [app.id, app]));
  const applications = buildApplications(manifest, environments, []).map(app => {
    const old = oldApps.get(app.id);
    if (app.kind === 'game' || !old) return app;
    return { ...app, targets: (old.targets || app.targets).map(target => ({ ...target,
      state: 'unknown', source: '過去の公開情報（GitHub更新失敗）', note: '公開処理の最新状態は未確認です。' })) };
  });
  return {
    ...previous, schemaVersion: 1, repository: 'charukun/soul-lineage',
    generatedAt: previous?.generatedAt || null,
    pullRequests: previous?.pullRequests || { normal: [], visualReview: [], total: 0, truncated: true },
    applications, environments, applicationsUpdatedAt: now, applicationsSource: 'public-manifest',
    environmentDiff: environmentDiff(environments[0], environments[2]),
    integration: { ...(previous?.integration || {}), state: 'unknown', tone: 'info', queue: previous?.integration?.queue || [] },
    alerts: [
      { type: 'github-sync-degraded', tone: 'warning', title: 'GitHub履歴の更新に失敗',
        detail: `${String(error?.message || error)}。公開環境の一覧は公開manifestから更新しています。` },
      ...(previous?.alerts || []).filter(alert => alert.type !== 'github-sync-degraded'),
    ],
    recentActionFailures: previous?.recentActionFailures || [],
    syncStatus: 'degraded', syncError: String(error?.message || error), lastAttemptAt: now, refreshReason: source,
    publicManifest: { url: 'https://charukun.github.io/soul-lineage/deployment-manifest.json', schemaVersion: 1,
      validatedDevelop: manifest.validatedDevelop || null, environmentSnapshots: manifest.environmentSnapshots || null },
  };
}
