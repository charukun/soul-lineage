import assert from 'node:assert/strict';
import { aiRepairEnvelope, aiRepairEnvelopeMarker } from './integration-ai-repair-envelope.mjs';
import { reviewDecision } from './integration-policy.mjs';
import { deepRepairSchema, findDeepRepairIssue, parseDeepRepairIssue } from './integration-deep-repair-lookup.mjs';
export { deepRepairSchema, parseDeepRepairIssue } from './integration-deep-repair-lookup.mjs';

const TRUSTED = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const HOLD_LABELS = new Set(['integration:hold', 'integration:manual', 'do-not-merge']);
export const deepRepairStatus = 'integration/deep-repair';
export const deepRepairMaxAttempts = 2;
export const chatRepairSchema = 'chat-repair:v1';
export const chatRepairOwner = 'charukun';

function labels(pr) {
  return (pr?.labels || []).map(label => label.name);
}

function explicitHold(pr) {
  return labels(pr).some(label => HOLD_LABELS.has(label)) || /^Integration-Hold:\s*\S+/im.test(pr?.body || '');
}

function compact(value, max = 800) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function deepRepairSafety({ pr, repository, dependenciesMerged, unresolved, reviews = [] }) {
  if (!pr || pr.state !== 'open' || pr.draft || pr.base?.ref !== 'develop') return 'not a Ready develop PR';
  if (pr.base?.repo?.full_name !== repository || pr.head?.repo?.full_name !== repository || !TRUSTED.has(pr.author_association)) {
    return 'external or untrusted PR';
  }
  if (explicitHold(pr)) return 'explicit Integration hold';
  if (!dependenciesMerged) return 'dependency PR is not merged into develop';
  const review = reviewDecision(reviews, pr.head.sha);
  if (review.rejected || unresolved) return 'unresolved review or requested changes';
  return null;
}

export function deepRepairIssueState({ pr, develop, reason, repairKind = 'semantic', ciFailure }) {
  const sourceKey = `pr:${pr.number}:head:${pr.head.sha}`;
  return {
    schema: deepRepairSchema,
    sourceKey,
    state: 'pending',
    attempt: 0,
    maxAttempts: deepRepairMaxAttempts,
    pr: pr.number,
    branch: pr.head.ref,
    head: pr.head.sha,
    develop,
    repairKind,
    ...(ciFailure ? { ciFailure } : {}),
    reason: compact(reason),
  };
}

export function deepRepairIssueMarker(state) {
  return `<!-- integration-deep-repair:v1\n${JSON.stringify(state)}\n-->`;
}

export function chatRepairBundle({ repository, pr, develop, reason, repairKind = 'semantic', ciFailure }) {
  assert.match(repository || '', /^[\w.-]+\/[\w.-]+$/, 'CHAT_REPAIR_REPOSITORY_REQUIRED');
  assert.ok(Number.isSafeInteger(Number(pr?.number)) && Number(pr.number) > 0, 'CHAT_REPAIR_PR_REQUIRED');
  assert.match(pr?.head?.sha || '', /^[0-9a-f]{40}$/i, 'CHAT_REPAIR_HEAD_REQUIRED');
  assert.match(develop || '', /^[0-9a-f]{40}$/i, 'CHAT_REPAIR_DEVELOP_REQUIRED');
  return {
    schema: chatRepairSchema,
    version: 1,
    sourceKey: `pr:${pr.number}:head:${pr.head.sha}`,
    repository,
    pr: Number(pr.number),
    branch: pr.head.ref,
    head: pr.head.sha,
    develop,
    repairKind,
    ...(ciFailure ? { ciFailure } : {}),
    reason: compact(reason),
    execution: 'normal-chat-manual-start',
    prohibited: ['chatgpt-work', 'codex', 'openai-api', 'paid-model-api'],
  };
}

export function chatRepairIssueMarker(bundle) {
  return `<!-- chat-repair:v1\n${JSON.stringify(bundle)}\n-->`;
}

export function parseChatRepairIssueMarker(body = '') {
  const match = String(body).match(/<!-- chat-repair:v1\n([^\n]+)\n-->/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[1]);
    if (value?.schema !== chatRepairSchema || value?.execution !== 'normal-chat-manual-start') return null;
    if (!/^[0-9a-f]{40}$/i.test(value.head || '') || !/^[0-9a-f]{40}$/i.test(value.develop || '')) return null;
    return value;
  } catch {
    return null;
  }
}

export function normalChatRepairPrompt({ repository, state, pr, ciFailure }) {
  const task = ciFailure ? `PR #${pr.number} exact-head CI source repair` : `PR #${pr.number} semantic conflict repair`;
  return `Repository: ${repository}\n\n` +
    `GitHub上の意味的競合/CI source repairを通常Chatで修復してください。Work / Codex / OpenAI API /追加の有料APIは使わないでください。\n\n` +
    `復旧座標は sourceKey \`${state.sourceKey}\`、source PR #${pr.number}、記録head \`${state.head}\`、記録develop \`${state.develop}\` です。これらは開始座標であり正本ではありません。最初にsourceKeyで同じGitHub Issueを取得し、現在のGitHub状態、current PR head、latest developを再取得してください。\n\n` +
    `Issueの \`integration-deep-repair:v1\` を再読し、closed / human-required / attempt上限ならコードを変更せず停止してください。別のclaimが \`working\` なら並行修復しないでください。\`pending\` なら編集前に同じIssueを \`state=working\`、\`attempt+1\`、\`claimedBy=normal-chat\`、\`claimedAt=<current ISO time>\` へ更新し、再取得して自分のclaimを確認してから作業してください。\n\n` +
    `最新develop SHA → AGENTS.md → checkoutがあれば \`npm run context:plan -- --task "${task}"\` → 必要文書だけ、の順で確認してください。過去チャット全文、全docs、巨大diff、全CIログを初期投入しないでください。\n\n` +
    `source PR側の意図とcurrent develop側の意図、関連する確定仕様・テストを読み、両立できる意図は両方残してください。無条件ours/theirs、blind cherry-pick、assertion削除、品質gate弱体化は禁止です。真のproduct/schema/save/protocol判断が必要で現在の契約から解けない場合だけ、このIssueをhuman-requiredにして必要な判断を具体化してください。\n\n` +
    `修復先は既存source PR branchだけです。通常git → 接続済みGitHub API → 必要時のみ同じbranchの既存Codespaces＋通常gitの順で経路を選び、1経路の失敗だけで停止しないでください。force pushは禁止です。\n\n` +
    `必要なfocused checkとfast validationを行い、検証済み修復を同じPRへpushしてください。push後は自分がclaimした同じIssueを \`state=ready-for-integration\` に更新し、\`repairHead\` と検証結果を記録してください。PRをReady for review → READY_FOR_INTEGRATIONまで戻してください。CI/browser/DEV完了は待機・pollingしないでください。main / Productionは変更しないでください。`;
}

function chatRepairSection({ repository, state, pr, develop, reason, repairKind, ciFailure, notifyOwner = true }) {
  const bundle = chatRepairBundle({ repository, pr, develop, reason, repairKind, ciFailure });
  const prompt = normalChatRepairPrompt({ repository, state, pr, ciFailure });
  const failure = ciFailure
    ? `\nFailed validation: ${ciFailure.jobUrl}\nRun: ${ciFailure.runId}, attempt: ${ciFailure.runAttempt}, job: ${ciFailure.jobId} (${ciFailure.jobName})\n通常Chatは編集前に必要なfailed job steps/log範囲だけ確認し、assertionを弱めないでください。\n`
    : '';
  const notice = notifyOwner
    ? 'CHAT_REPAIR_REQUIRED'
    : 'CHAT_REPAIR_REFRESHED\n\n同じsource PRの未解決Chat Repair Issueをcurrent exact-headへ更新しました。owner mention / assignment通知は再送しません。';
  const footer = notifyOwner
    ? 'このIssue/メールは起動通知です。修復時は必ずcurrent GitHub stateを再取得してください。GitHub通知メールの配送有無はownerのGitHub通知設定に従います。'
    : 'これは既存repair incidentのexact-head更新です。新しい起動メールは作らず、修復時はcurrent GitHub stateを再取得してください。';
  return `${chatRepairIssueMarker(bundle)}\n\n${notice}\n\n` +
    `Fast Lane found a current exact-head ${ciFailure ? 'CI failure' : 'semantic conflict'} that requires source repair. ChatGPT Work/Codex/APIによる自動修復は使用しません。\n\n` +
    `PR: ${pr.html_url}\nRecorded head: \`${pr.head.sha}\`\nRecorded develop: \`${develop}\`\nReason: ${state.reason}\n${failure}\n` +
    `## 通常Chatへ貼り付けるプロンプト\n\n\`\`\`text\n${prompt}\n\`\`\`\n\n${footer}`;
}

function repairEnvelope({ pr, develop, reason, repairKind, ciFailure }) {
  return aiRepairEnvelope({
    pr: pr.number,
    branch: pr.head.ref,
    head: pr.head.sha,
    develop,
    repairKind,
    reason,
    attempt: 0,
    maxAttempts: deepRepairMaxAttempts,
    source: 'integration-fast-lane',
    deep: true,
    ...(ciFailure ? { ciFailure } : {}),
  });
}

function currentIssueBody({ repository, state, pr, develop, reason, repairKind, ciFailure, notifyOwner }) {
  const marker = deepRepairIssueMarker(state);
  const envelope = repairEnvelope({ pr, develop, reason, repairKind, ciFailure });
  const section = chatRepairSection({ repository, state, pr, develop, reason, repairKind, ciFailure, notifyOwner });
  return `${marker}\n${aiRepairEnvelopeMarker(envelope)}\n\n${section}`;
}

function generationMatches(existing, state) {
  return existing?.sourceKey === state.sourceKey && existing?.head === state.head &&
    existing?.develop === state.develop && existing?.repairKind === state.repairKind;
}

function terminalIncident(issue, state) {
  return issue?.state === 'closed' || state?.state === 'human-required' || state?.state === 'completed' ||
    state?.attempt >= state?.maxAttempts;
}

export async function signalDeepRepair(c, { pr, repository, develop, reason, repairKind = 'semantic', ciFailure, dependenciesMerged,
  unresolved, reviews = [] }) {
  const blocked = deepRepairSafety({ pr, repository, dependenciesMerged, unresolved, reviews });
  if (blocked) return { signaled: false, blocked };
  assert.match(develop || '', /^[0-9a-f]{40}$/i, 'DEEP_REPAIR_DEVELOP_REQUIRED');
  assert.match(pr.head.sha || '', /^[0-9a-f]{40}$/i, 'DEEP_REPAIR_HEAD_REQUIRED');

  if (ciFailure) assert.equal(ciFailure.head, pr.head.sha, 'DEEP_REPAIR_FAILURE_HEAD_MISMATCH');
  const state = deepRepairIssueState({ pr, develop, reason, repairKind, ciFailure });
  let issue = await findDeepRepairIssue(c, { repository, pr });
  const existing = issue && parseDeepRepairIssue(issue.body);
  if (existing && terminalIncident(issue, existing)) {
    return { signaled: false, blocked: `Deep Repair #${issue.number} already owns PR #${pr.number} in ${existing.state}`, issue: issue.number };
  }

  if (!issue) {
    issue = await c.api('POST', `${c.root}/issues`, {
      title: `[RINNE 要Chat修復] PR #${pr.number}`,
      assignees: [chatRepairOwner],
      body: currentIssueBody({ repository, state, pr, develop, reason, repairKind, ciFailure, notifyOwner: true }),
    });
  } else if (!parseChatRepairIssueMarker(issue.body)) {
    const current = currentIssueBody({ repository, state, pr, develop, reason, repairKind, ciFailure, notifyOwner: true });
    issue = await c.api('PATCH', `${c.root}/issues/${issue.number}`, {
      title: `[RINNE 要Chat修復] PR #${pr.number}`,
      assignees: [chatRepairOwner],
      body: `${current}\n\n---\n\nWORK_REPAIR_RETIRED\n\n${issue.body || ''}`,
    });
  } else if (!generationMatches(existing, state)) {
    if (existing.state === 'working') {
      return { signaled: false, blocked: `Deep Repair #${issue.number} is working on the previous exact-head generation`, issue: issue.number };
    }
    issue = await c.api('PATCH', `${c.root}/issues/${issue.number}`, {
      title: `[RINNE 要Chat修復] PR #${pr.number}`,
      body: currentIssueBody({ repository, state, pr, develop, reason, repairKind, ciFailure, notifyOwner: false }),
    });
  } else if (!['pending', 'working'].includes(existing.state)) {
    return { signaled: false, blocked: `Deep Repair #${issue.number} already owns this exact-head generation in ${existing.state}`, issue: issue.number };
  }

  await c.api('POST', `${c.root}/statuses/${pr.head.sha}`, {
    state: 'pending',
    context: deepRepairStatus,
    description: `Exact-head ${ciFailure ? 'CI failure' : 'conflict'} requires normal Chat repair`,
    target_url: issue.html_url || pr.html_url,
  });

  return { signaled: true, issue: issue.number, url: issue.html_url, sourceKey: state.sourceKey };
}
