import { dependencies } from './integration-policy.mjs';

const SHA = /^[0-9a-f]{40}$/i;

function mergedDependency(dep, repository) {
  return Boolean(dep?.merged || dep?.merged_at) && dep.base?.ref === 'develop' && dep.base?.repo?.full_name === repository;
}

function dependencyPresent(comparison) {
  return comparison?.status === 'ahead' || comparison?.status === 'identical';
}

export async function dependencyState(c, pr, { dependencyPulls = null, cache = false } = {}) {
  const numbers = dependencies(pr.body || '');
  if (numbers.length === 0) return { numbers, merged: true, incorporated: true, missing: [] };

  const repository = pr.base?.repo?.full_name;
  const pulls = dependencyPulls || await Promise.all(numbers.map(number =>
    c.api('GET', `${c.root}/pulls/${number}`, null, { cache })));
  if (pulls.length !== numbers.length || !pulls.every(dep => mergedDependency(dep, repository))) {
    return { numbers, merged: false, incorporated: false, missing: numbers };
  }

  const missing = [];
  for (let index = 0; index < numbers.length; index++) {
    const mergeSha = pulls[index]?.merge_commit_sha;
    if (!SHA.test(mergeSha || '')) {
      missing.push(numbers[index]);
      continue;
    }
    const comparison = await c.api('GET', `${c.root}/compare/${mergeSha}...${pr.head.sha}`, null, { cache });
    if (!dependencyPresent(comparison)) missing.push(numbers[index]);
  }
  return { numbers, merged: true, incorporated: missing.length === 0, missing };
}
