#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const mode = process.argv[2] ?? 'sync';
const remote = process.env.PRE_READY_REMOTE ?? 'origin';
const baseBranch = process.env.PRE_READY_BASE ?? 'develop';

if (!new Set(['sync', 'verify']).has(mode)) {
  console.error(`[pre-ready] unsupported mode: ${mode}`);
  process.exit(64);
}

function git(args, { inherit = false, allowFailure = false } = {}) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }

  if (!allowFailure && result.status !== 0) {
    const detail = `${result.stderr ?? ''}`.trim();
    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }

  return result;
}

function output(args) {
  return `${git(args).stdout ?? ''}`.trim();
}

function isAncestor(ancestor, descendant) {
  const result = git(['merge-base', '--is-ancestor', ancestor, descendant], { allowFailure: true });
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  const detail = `${result.stderr ?? ''}`.trim();
  throw new Error(`git merge-base failed${detail ? `: ${detail}` : ''}`);
}

function assertReadyWorkspace() {
  const branch = output(['branch', '--show-current']);
  if (!branch) {
    throw new Error('PRE_READY_BRANCH_REQUIRED: detached HEAD cannot be handed off');
  }
  if (branch === baseBranch || branch === 'main') {
    throw new Error(`PRE_READY_WORK_BRANCH_REQUIRED: refusing to run on ${branch}`);
  }

  const status = output(['status', '--porcelain']);
  if (status) {
    throw new Error('PRE_READY_CLEAN_WORKTREE_REQUIRED: commit or resolve local changes before reconciliation');
  }

  return branch;
}

function fetchCurrentBase() {
  const result = git(['fetch', '--no-tags', remote, baseBranch], { allowFailure: true });
  if (result.status !== 0) {
    const detail = `${result.stderr ?? ''}`.trim();
    throw new Error(`PRE_READY_FETCH_FAILED: ${detail || `${remote}/${baseBranch}`}`);
  }
  return `${remote}/${baseBranch}`;
}

try {
  const branch = assertReadyWorkspace();
  const baseRef = fetchCurrentBase();
  const developSha = output(['rev-parse', baseRef]);
  const headBefore = output(['rev-parse', 'HEAD']);
  const fresh = isAncestor(baseRef, 'HEAD');

  if (mode === 'verify') {
    if (!fresh) {
      console.error(`[pre-ready] PRE_READY_STALE branch=${branch} develop=${developSha} head=${headBefore}`);
      process.exit(2);
    }
    console.log(`[pre-ready] PRE_READY_FRESH branch=${branch} develop=${developSha} head=${headBefore}`);
    process.exit(0);
  }

  if (fresh) {
    console.log(`[pre-ready] PRE_READY_ALREADY_FRESH branch=${branch} develop=${developSha} head=${headBefore}`);
    process.exit(0);
  }

  const merge = git(['merge', '--no-edit', baseRef], { inherit: true, allowFailure: true });
  if (merge.status !== 0) {
    console.error(`[pre-ready] PRE_READY_CONFLICT branch=${branch} develop=${developSha}; resolve the merge semantically, revalidate, then rerun sync`);
    process.exit(3);
  }

  if (!isAncestor(baseRef, 'HEAD')) {
    throw new Error('PRE_READY_POST_MERGE_INVARIANT_FAILED: reconciled head does not contain fetched develop');
  }

  const headAfter = output(['rev-parse', 'HEAD']);
  console.log(`[pre-ready] PRE_READY_SYNCED branch=${branch} develop=${developSha} head=${headAfter}`);
} catch (error) {
  console.error(`[pre-ready] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
