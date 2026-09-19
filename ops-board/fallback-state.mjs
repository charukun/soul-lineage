import { buildApplications } from './applications.mjs';

function githubFailure(error) {
  const diagnostic = error?.githubDiagnostic;
  if (!diagnostic || typeof diagnostic !== 'object') return null;
  return {
    kind: diagnostic.kind || 'http',
    status: Number.isFinite(diagnostic.status) ? diagnostic.status : null,
    scope: diagnostic.scope || null,
    limit: Number.isFinite(diagnostic.limit) ? diagnostic.limit : null,
    remaining: Number.isFinite(diagnostic.remaining) ? diagnostic.remaining : null,
    used: Number.isFinite(diagnostic.used) ? diagnostic.used : null,
    resource: diagnostic.resource || null,
    resetAt: diagnostic.resetAt || null,
    retryAfter: diagnostic.retryAfter || null,
    retryAt: diagnostic.retryAt || (error?.retryAt ? new Date(error.retryAt).toISOString() : null),
    requests: Number.isFinite(diagnostic.requests) ? diagnostic.requests : null,
    maxRequests: Number.isFinite(diagnostic.maxRequests) ? diagnostic.maxRequests : null,
  };
}

export async function degradedState(previous, error, { source='manual', now=new Date().toISOString() }={}) {
  const base = previous || {
    repository:'charukun/soul-lineage',
    schemaVersion:2,
    generatedAt:null,
    pullRequests:{ normal:[], visualReview:[], total:0, truncated:true },
    applications:buildApplications({}, [], [], { developSha:null, statuses:[] }),
    environments:[],
    environmentDiff:{ count:null, label:'最新状態を未確認', pulls:[] },
    integration:{ phase:'reconcile-wait', tone:'info', queue:[] },
    recentActionFailures:[],
    actionHistory:[],
    alerts:[],
    history:{ schema:1, snapshots:[], publications:[] },
  };
  return {
    ...base,
    schemaVersion:2,
    repository:'charukun/soul-lineage',
    syncStatus:'degraded',
    syncError:String(error?.message || error || 'GitHub状態を取得できません'),
    syncSource:'PULSE last-known-good / catalog fallback',
    lastAttemptAt:now,
    refreshReason:source,
    githubFailure:githubFailure(error),
    nextRetryAt:error?.retryAt ? new Date(error.retryAt).toISOString() : null,
    applications:Array.isArray(base.applications) && base.applications.length
      ? base.applications
      : buildApplications({}, [], [], { developSha:null, statuses:[] }),
    alerts:[
      { type:'github-sync-degraded', tone:'warning', title:'最新状態を未確認',
        detail:String(error?.message || error || 'GitHub状態を取得できません') },
      ...(base.alerts || []).filter(alert => alert.type !== 'github-sync-degraded'),
    ],
  };
}
