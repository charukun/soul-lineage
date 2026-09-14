import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { REPOSITORY, STATE_BRANCH } from './integration-rescue-policy.mjs';
import { rescueClient } from './integration-rescue-store.mjs';

function decodeState(file) {
  assert.equal(file?.encoding, 'base64', 'RESCUE_STATE_ENCODING');
  assert.ok(file.content, 'RESCUE_STATE_EMPTY');
  return JSON.parse(Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8'));
}

export async function reusableRescueFastEvidence(c, prNumber, headSha) {
  const file = await c.api('GET', `${c.root}/contents/rescue-state.json?ref=${encodeURIComponent(STATE_BRANCH)}`);
  const state = decodeState(file);
  assert.equal(state.repository, REPOSITORY, 'RESCUE_STATE_REPOSITORY');
  const record = state.records?.[prNumber];
  if (!record || record.mode === 'reevaluate') return null;
  if (record.pushedSha !== headSha || record.stagedSha !== headSha) return null;
  if (record.validation?.status !== 'passed' || record.validation.head !== headSha || !record.validation.testedTree || record.validation.testedTree !== record.stagedTree) return null;
  if (!record.runId || !record.rescueId || !record.claimedBy) return null;

  const commit = await c.api('GET', `${c.root}/git/commits/${headSha}`);
  if (commit.tree?.sha !== record.stagedTree) return null;
  const run = await c.api('GET', `${c.root}/actions/runs/${record.runId}`);
  if (run.repository?.full_name !== REPOSITORY || run.head_branch !== 'develop' || run.path !== '.github/workflows/deploy.yml' || run.status !== 'completed' || run.conclusion !== 'success') return null;
  const jobs = await c.pages(`/actions/runs/${record.runId}/jobs?filter=latest`, 'jobs', { maxPages: 3 });
  const job = jobs.find(item => item.name === `Rescue PR ${prNumber}` || item.name?.endsWith(` / Rescue PR ${prNumber}`));
  if (job?.status !== 'completed' || job.conclusion !== 'success') return null;
  const stage = job.steps?.find(step => step.name === 'Verify the safe base update and stage its exact commit for Work push');
  if (stage?.conclusion !== 'success') return null;
  return {
    pr: Number(prNumber), head: headSha, tree: record.stagedTree, runId: String(record.runId),
    rescueId: record.rescueId, workerId: record.claimedBy, validatedAt: record.validation.at || null,
  };
}

async function main() {
  const pr = Number(process.env.PR_NUMBER);
  const head = process.env.HEAD_SHA;
  assert.ok(Number.isSafeInteger(pr) && pr > 0, 'PR_NUMBER_REQUIRED');
  assert.match(head || '', /^[0-9a-f]{40}$/i, 'HEAD_SHA_REQUIRED');
  const c = rescueClient(process.env.GH_TOKEN, { apiReserve: 100, maxRequests: 40 });
  let evidence = null;
  try {
    evidence = await reusableRescueFastEvidence(c, pr, head);
  } catch (error) {
    console.log(`Rescue fast evidence unavailable; normal CI will run: ${error.message}`);
  }
  const reuse = Boolean(evidence);
  console.log(JSON.stringify({ reuse, evidence }));
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `reuse=${reuse}\n`);
    if (evidence) {
      appendFileSync(process.env.GITHUB_OUTPUT, `run_id=${evidence.runId}\n`);
      appendFileSync(process.env.GITHUB_OUTPUT, `tested_tree=${evidence.tree}\n`);
      appendFileSync(process.env.GITHUB_OUTPUT, `worker_id=${evidence.workerId}\n`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
