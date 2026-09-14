const SHA = /^[a-f0-9]{40}$/;
export const GOVERNANCE_CONTEXT = 'governance/branch-protection';
export const REQUIRED_BRANCHES = ['develop', 'main'];

export function evaluateBranchProtection(branches) {
  const records = REQUIRED_BRANCHES.map(name => {
    const branch = branches?.[name];
    return {
      name,
      sha: branch?.commit?.sha || null,
      protected: branch?.protected === true,
    };
  });
  return {
    ok: records.every(record => record.protected && SHA.test(record.sha || '')),
    branches: records,
  };
}

async function request(url, token, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`${init.method || 'GET'} ${new URL(url).pathname}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}

export async function auditRepositoryGovernance({ repository, token, serverUrl = 'https://api.github.com' }) {
  if (!repository || !token) throw new Error('repository and token are required');
  const base = `${serverUrl.replace(/\/$/, '')}/repos/${repository}`;
  const entries = await Promise.all(REQUIRED_BRANCHES.map(async name => [name, await request(`${base}/branches/${name}`, token)]));
  const result = evaluateBranchProtection(Object.fromEntries(entries));
  const target = `https://github.com/${repository}/settings/rules`;
  await Promise.all(result.branches.filter(branch => SHA.test(branch.sha || '')).map(branch => request(`${base}/statuses/${branch.sha}`, token, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      state: branch.protected ? 'success' : 'failure',
      context: GOVERNANCE_CONTEXT,
      description: branch.protected
        ? `${branch.name} is protected by GitHub rules`
        : `${branch.name} is NOT protected; administration action required`,
      target_url: target,
    }),
  })));
  return result;
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN;
  const result = await auditRepositoryGovernance({ repository, token });
  console.log('REPOSITORY_GOVERNANCE', JSON.stringify(result));
  if (!result.ok) {
    console.error('::warning::develop/main branch protection is incomplete. Failure statuses were recorded; repository policy must not treat this as protected.');
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch(error => {
    console.error(`REPOSITORY_GOVERNANCE_AUDIT_FAILED ${error.message}`);
    process.exitCode = 1;
  });
}
