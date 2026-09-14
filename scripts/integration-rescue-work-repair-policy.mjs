const REPAIR_CLASSES = [
  ['semantic', /^FAILED_MANUAL:SEMANTIC_CONFLICT(?::|$)/],
  ['overlap', /^FAILED_MANUAL:OVERLAPPING_CHANGES(?::|$)/],
  ['related', /^FAILED_MANUAL:RELATED_CODE_RECONCILIATION(?::|$)/],
  ['control', /^FAILED_MANUAL:CONTROL_OR_CONTRACT_RECONCILIATION(?::|$)/],
  ['assertion', /^FAILED_MANUAL:ASSERTION_REMOVAL(?::|$)/],
  ['ci', /(?:current head fast gate or another check is not successful|CI_GATE_FAILED|VALIDATION_FAILED(?::|$)|Affected browser smoke|browser smoke)/i],
  ['large-base', /(?:Large base comparison needs manual Integration review|LARGE_BASE_RECONCILIATION)/i],
  ['transport', /(?:GitHub POST .*\/git\/trees: HTTP 422|TREE_STAGING|GIT_TREE.*422)/i],
];
const BASELINE_ADVANCE = /(?:^WORK_REPAIR_BASELINE_ADVANCED:|DEVELOP_ADVANCED_AFTER_VALIDATION|Latest develop advanced from [0-9a-f]{40} to [0-9a-f]{40})/i;
export const MAX_WORK_REPAIR_ATTEMPTS = 2;
export const MAX_BASELINE_CHURNS = 8;

function repairReasons(record) {
  return [
    String(record?.failureReason || ''),
    ...(Array.isArray(record?.failures) ? [...record.failures].reverse().map(item => String(item?.reason || '')) : []),
  ].filter(Boolean);
}

export function workRepairClass(record) {
  for (const reason of repairReasons(record)) {
    const match = REPAIR_CLASSES.find(([, pattern]) => pattern.test(reason));
    if (match) return match[0];
  }
  return null;
}

export function workRepairBaselineAdvanceReason(reason) {
  return BASELINE_ADVANCE.test(String(reason || ''));
}

export function workRepairResumesAfterBaselineAdvance(record) {
  return record?.workRepair?.status === 'baseline-advanced' ||
    (record?.workRepair?.status === 'failed' && workRepairBaselineAdvanceReason(record.workRepair.reason));
}

export function workRepairEligibility(record) {
  const kind = workRepairClass(record);
  if (!kind) return { eligible:false, reason:'MANUAL_REASON_NOT_AUTOMATABLE' };
  if (record?.workRepair?.status === 'human-required') return { eligible:false, reason:'HUMAN_DECISION_REQUIRED' };
  const attempts = Number(record?.workRepairAttempts || 0);
  const baselineChurns = Number(record?.workRepairBaselineChurns || 0);
  const resumeBaseline = workRepairResumesAfterBaselineAdvance(record);
  if (resumeBaseline && baselineChurns >= MAX_BASELINE_CHURNS) {
    return { eligible:false, reason:'WORK_REPAIR_BASELINE_CHURN_EXHAUSTED', kind, attempts, maxAttempts:MAX_WORK_REPAIR_ATTEMPTS, baselineChurns, maxBaselineChurns:MAX_BASELINE_CHURNS };
  }
  if (attempts >= MAX_WORK_REPAIR_ATTEMPTS && !resumeBaseline) return { eligible:false, reason:'WORK_REPAIR_ATTEMPTS_EXHAUSTED' };
  return { eligible:true, kind, attempts, maxAttempts:MAX_WORK_REPAIR_ATTEMPTS, baselineChurns, maxBaselineChurns:MAX_BASELINE_CHURNS, resumeBaseline };
}
