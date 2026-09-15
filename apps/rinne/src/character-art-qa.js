import './character-art-qa.css';
import { CHARACTER_REFINEMENT_CHECKS, CHARACTER_REFINEMENT_MAX_ROUNDS, CHARACTER_REFINEMENT_POLICY, CHARACTER_REFINEMENT_VIEWS, createCharacterRefinementRound } from '@soul/characters';
import { stylizedArtAudit, compareStylizedSilhouettes } from '@soul/rendering/stylized-art';
import { auditTextureBudget } from '@soul/rendering/texture-quality';
import { productionArtProfileForActorId } from '@soul/rendering/master-character-production';

const el = id => document.getElementById(id);
const text = (tag, value, className = '') => { const node = document.createElement(tag); node.textContent = value; node.className = className; return node; };
const formatNumber = value => Number.isFinite(value) ? Math.round(value).toLocaleString() : '-';
const formatMiB = value => Number.isFinite(value) ? `${(value / 1024 / 1024).toFixed(1)} MiB` : '-';

function actorAudit(actor, review = window.masterCharacterReview) {
  if (!actor?.root) return null;
  const profileId = actor.root.userData?.stylizedArt?.profileId || productionArtProfileForActorId(actor.id);
  const body = stylizedArtAudit(actor.root, profileId);
  const attachments = actor.attachments?.children?.length ? stylizedArtAudit(actor.attachments, profileId) : null;
  const textureBudget = auditTextureBudget(actor.root, { softBytes: profileId === 'hero' ? 64 * 1024 * 1024 : 32 * 1024 * 1024, maxDimension: profileId === 'hero' ? 4096 : 2048 });
  const totalTriangles = body.triangles + (attachments?.triangles ?? 0);
  const totalMaterials = body.materials + (attachments?.materials ?? 0);
  const warnings = [...body.warnings];
  const errors = [...body.errors];
  for (const value of attachments?.warnings ?? []) warnings.push(`attachment: ${value}`);
  for (const value of attachments?.errors ?? []) if (value !== 'silhouette envelope is invalid') errors.push(`attachment: ${value}`);
  if (totalTriangles > body.budget.softTriangleBudget) warnings.push(`character + equipment triangles ${totalTriangles.toLocaleString()} > soft budget ${body.budget.softTriangleBudget.toLocaleString()}`);
  if (totalMaterials > body.budget.softMaterialBudget) warnings.push(`character + equipment materials ${totalMaterials} > soft budget ${body.budget.softMaterialBudget}`);
  if (textureBudget.gate === 'review') warnings.push(`texture budget ${formatMiB(textureBudget.estimatedBytes)} / oversized ${textureBudget.oversized} / uncompressed candidates ${textureBudget.uncompressed}`);

  let hero = null;
  if (profileId === 'hero') {
    const s = body.silhouette, report = review?.motionQA?.report;
    const heroWarnings = [], heroErrors = [];
    if (!s.valid) heroErrors.push('Shino Hero Gate: silhouette envelope missing');
    else {
      if (s.frontAspect < .18 || s.frontAspect > .90) heroWarnings.push(`Shino Hero Gate: front silhouette aspect ${s.frontAspect.toFixed(2)} needs visual review`);
      if (s.sideAspect < .10 || s.sideAspect > .78) heroWarnings.push(`Shino Hero Gate: side silhouette aspect ${s.sideAspect.toFixed(2)} needs visual review`);
      if (s.diagonalAspect < Math.min(s.frontAspect, s.sideAspect) * .82) heroWarnings.push('Shino Hero Gate: three-quarter silhouette collapses unexpectedly');
    }
    if (!report) heroWarnings.push('Shino Hero Gate: Motion QA has not been recorded');
    else {
      const unresolved = report.issues.filter(issue => ['open', 'needs-review'].includes(issue.status) && ['warning', 'error'].includes(issue.severity));
      if (unresolved.length) heroWarnings.push(`Shino Hero Gate: ${unresolved.length} unresolved Motion QA issue(s)`);
      if (report.visualApproval === 'changes-requested') heroErrors.push('Shino Hero Gate: visual approval requests changes');
      else if (report.visualApproval !== 'approved') heroWarnings.push('Shino Hero Gate: explicit visual approval is still pending');
    }
    warnings.push(...heroWarnings); errors.push(...heroErrors);
    hero = { visualApproval: report?.visualApproval ?? 'not-recorded', warnings: heroWarnings, errors: heroErrors };
  }
  const gate = errors.length ? 'fail' : warnings.length ? 'review' : 'pass';
  return { id: actor.id, profileId, body, attachments, textureBudget, animationLOD: actor.root.userData?.animationLOD || null, totalTriangles, totalMaterials, warnings, errors, hero, gate };
}

function metricCard(label, id) {
  const card = text('div', '', 'art-qa-card');
  card.append(text('b', label));
  const output = document.createElement('output'); output.id = id; card.append(output); return card;
}

function createRefinementController(review, section) {
  const sessions = new Map();
  const refinement = text('section', '', 'art-refinement'); refinement.setAttribute('aria-label', '局所改善チェック');
  const head = text('div', '', 'art-refinement-head');
  head.append(text('h3', `形状リファイン · 最大${CHARACTER_REFINEMENT_MAX_ROUNDS}回`));
  const round = text('output', '1 / 3', 'art-refinement-round'); round.id = 'art-refinement-round'; head.append(round); refinement.append(head);
  refinement.append(text('p', `固定確認: ${CHARACTER_REFINEMENT_VIEWS.join(' / ')}。PASS領域は固定し、FAIL部位だけ修正します。`, 'art-refinement-note'));
  const checklist = text('div', '', 'art-refinement-list'); refinement.append(checklist);
  const summary = text('p', '6項目を確認してください。', 'art-refinement-summary'); summary.id = 'art-refinement-summary'; refinement.append(summary);
  const actions = text('div', '', 'art-refinement-actions');
  const next = text('button', 'FAILだけ次のラウンドへ'); next.type = 'button'; next.id = 'art-refinement-next';
  const reset = text('button', '判定をリセット'); reset.type = 'button'; reset.id = 'art-refinement-reset';
  actions.append(next, reset); refinement.append(actions); section.append(refinement);

  const blankResults = () => Object.fromEntries(CHARACTER_REFINEMENT_CHECKS.map(check => [check.id, 'pending']));
  const key = () => review.actors?.[review.settings?.selected ?? 0]?.id ?? 'unloaded';
  const session = () => {
    const actorId = key();
    if (!sessions.has(actorId)) sessions.set(actorId, { round: 1, results: blankResults() });
    return sessions.get(actorId);
  };
  const plan = () => { const current = session(); return createCharacterRefinementRound(current.round, current.results); };
  const setResult = (id, status) => { session().results[id] = status; render(); };
  function render() {
    const current = session(), currentPlan = plan();
    round.textContent = `${current.round} / ${CHARACTER_REFINEMENT_MAX_ROUNDS}`;
    checklist.replaceChildren(...CHARACTER_REFINEMENT_CHECKS.map(check => {
      const row = text('div', '', 'art-refinement-row'); row.dataset.status = current.results[check.id]; row.append(text('span', check.label, 'art-refinement-label'));
      const pass = text('button', 'PASS'); pass.type = 'button'; pass.dataset.refinementCheck = check.id; pass.dataset.refinementStatus = 'pass'; pass.setAttribute('aria-pressed', String(current.results[check.id] === 'pass')); pass.addEventListener('click', () => setResult(check.id, 'pass'));
      const fail = text('button', 'FAIL'); fail.type = 'button'; fail.dataset.refinementCheck = check.id; fail.dataset.refinementStatus = 'fail'; fail.setAttribute('aria-pressed', String(current.results[check.id] === 'fail')); fail.addEventListener('click', () => setResult(check.id, 'fail'));
      row.append(pass, fail); return row;
    }));
    const passCount = currentPlan.preserveChecks.length, failCount = currentPlan.failedChecks.length, pendingCount = currentPlan.pendingChecks.length;
    summary.textContent = currentPlan.state === 'pass'
      ? '6項目 PASS。形状チェック完了。Visual Approvalは従来どおり別判定です。'
      : currentPlan.state === 'escalate'
        ? `3回到達 · FAIL ${failCount}。未解決部位だけ外部参照/置換を検討し、出典・ライセンスを確認してください。`
        : `PASS ${passCount} / FAIL ${failCount} / 未確認 ${pendingCount}。PASSは保持し、FAILだけ局所修正します。`;
    next.disabled = currentPlan.state === 'pass' || currentPlan.pendingChecks.length > 0 || current.round >= CHARACTER_REFINEMENT_MAX_ROUNDS;
    window.__CHARACTER_REFINEMENT_STATE__ = currentPlan;
  }
  next.addEventListener('click', () => {
    const current = session(), currentPlan = plan();
    if (currentPlan.pendingChecks.length || !currentPlan.failedChecks.length || current.round >= CHARACTER_REFINEMENT_MAX_ROUNDS) return;
    const failed = new Set(currentPlan.failedChecks);
    for (const id of Object.keys(current.results)) if (failed.has(id)) current.results[id] = 'pending';
    current.round += 1; render();
  });
  reset.addEventListener('click', () => { sessions.set(key(), { round: 1, results: blankResults() }); render(); });
  return Object.freeze({ render, plan });
}

function install() {
  const panel = el('panel-qa'), review = window.masterCharacterReview;
  if (!panel || !review || el('art-qa')) return;
  const tab = el('tab-qa'); if (tab) tab.textContent = '品質QA';
  const section = text('section', '', 'art-qa'); section.id = 'art-qa'; section.setAttribute('aria-label', '美術・負荷QA');
  const head = text('div', '', 'art-qa-head'); head.append(text('h2', 'Art / Performance QA'));
  const gate = text('span', '準備中', 'art-gate'); gate.id = 'art-qa-gate'; head.append(gate); section.append(head);
  const grid = text('div', '', 'art-qa-grid');
  grid.append(metricCard('Profile', 'art-qa-profile'), metricCard('Triangles', 'art-qa-triangles'), metricCard('Materials', 'art-qa-materials'), metricCard('Textures', 'art-qa-textures'), metricCard('LOD', 'art-qa-lod'), metricCard('Motion LOD', 'art-qa-motion-lod'), metricCard('Silhouette', 'art-qa-silhouette'), metricCard('Frame', 'art-qa-frame'));
  section.append(grid);

  const refinementController = createRefinementController(review, section);

  const actions = text('div', '', 'art-qa-actions');
  const selected = text('button', '選択個体を再監査'); selected.type = 'button'; selected.id = 'art-qa-selected';
  const cohort = text('button', '全個体シルエット比較'); cohort.type = 'button'; cohort.id = 'art-qa-cohort';
  const front = text('button', '正面で確認'); front.type = 'button'; front.addEventListener('click', () => review.aim?.('front'));
  const side = text('button', '横で確認'); side.type = 'button'; side.addEventListener('click', () => review.aim?.('side'));
  const back = text('button', '背面で確認'); back.type = 'button'; back.addEventListener('click', () => review.aim?.('back'));
  actions.append(selected, cohort, front, side, back); section.append(actions);
  const report = text('pre', 'モデル読み込み後に自動監査します。', 'art-qa-report'); report.id = 'art-qa-report'; section.append(report);
  panel.prepend(section);

  let pending = false;
  function renderPerf() {
    const perf = review.measure?.();
    if (el('art-qa-frame')) el('art-qa-frame').textContent = perf?.fps ? `${perf.fps.toFixed(1)} FPS / ${perf.info.calls} calls` : '計測中';
  }
  function renderSelected() {
    pending = false;
    const actor = review.actors?.[review.settings?.selected ?? 0], audit = actorAudit(actor, review);
    refinementController.render();
    if (!audit) { renderPerf(); return; }
    const body = audit.body;
    el('art-qa-profile').textContent = audit.profileId === 'hero' ? 'hero · SHINO GATE' : audit.profileId;
    el('art-qa-triangles').textContent = `${formatNumber(audit.totalTriangles)} / soft ${formatNumber(body.budget.softTriangleBudget)}`;
    el('art-qa-materials').textContent = `${audit.totalMaterials} / soft ${body.budget.softMaterialBudget}`;
    el('art-qa-textures').textContent = `${audit.textureBudget.count} tex / ${formatMiB(audit.textureBudget.estimatedBytes)}`;
    el('art-qa-lod').textContent = `${body.lod.installed}/${body.lod.eligible} mesh`;
    const motionLOD = audit.animationLOD;
    el('art-qa-motion-lod').textContent = motionLOD ? `${motionLOD.id} · ${motionLOD.hz}Hz${motionLOD.secondaryMotion ? ' · spring' : ''}` : (audit.profileId === 'hero' ? 'hero · 60Hz' : '未計測');
    const s = body.silhouette;
    el('art-qa-silhouette').textContent = s.valid ? `前 ${s.frontAspect.toFixed(2)} / 横 ${s.sideAspect.toFixed(2)} / 3/4 ${s.diagonalAspect.toFixed(2)}` : '未取得';
    renderPerf();
    gate.textContent = audit.gate.toUpperCase(); gate.dataset.gate = audit.gate;
    const heroLine = audit.hero ? [`HERO Visual Approval: ${audit.hero.visualApproval}`] : [];
    report.textContent = audit.errors.length || audit.warnings.length ? [...heroLine, ...audit.errors.map(v => `ERROR ${v}`), ...audit.warnings.map(v => `WARN ${v}`)].join('\n') : [...heroLine, '共有Material token・Texture予算・形状予算・LOD・シルエットの自動監査で問題なし。'].join('\n');
    el('stage')?.setAttribute('data-art-gate', audit.gate);
    window.__CHARACTER_ART_QA_LAST__ = audit;
  }
  function schedule() { if (pending) return; pending = true; requestAnimationFrame(renderSelected); }
  function renderCohort() {
    const rows = (review.actors || []).map(actor => actorAudit(actor, review)).filter(Boolean);
    const pairs = compareStylizedSilhouettes(rows.map(row => ({ id: row.id, silhouette: row.body.silhouette })));
    const gates = rows.reduce((map, row) => { map[row.gate] = (map[row.gate] || 0) + 1; return map; }, {});
    report.textContent = `${rows.length}体監査 · PASS ${gates.pass || 0} / REVIEW ${gates.review || 0} / FAIL ${gates.fail || 0}\n${pairs.length ? `近似シルエット ${pairs.length}組\n` + pairs.slice(0, 10).map(p => `${p.a} ↔ ${p.b}  distance ${p.distance.toFixed(4)}`).join('\n') : '近似シルエットなし'}`;
    window.__CHARACTER_ART_QA_COHORT__ = { rows, pairs };
  }
  selected.addEventListener('click', renderSelected); cohort.addEventListener('click', renderCohort);
  window.addEventListener('character-review-change', schedule);
  window.addEventListener('character-workspace-change', schedule);
  const observer = new MutationObserver(renderPerf); if (el('metrics')) observer.observe(el('metrics'), { childList: true, characterData: true, subtree: true });
  window.__CHARACTER_REFINEMENT_POLICY__ = CHARACTER_REFINEMENT_POLICY;
  window.__CHARACTER_ART_QA__ = Object.freeze({ selected: renderSelected, cohort: renderCohort, actorAudit: actor => actorAudit(actor, review), refinement: refinementController.plan });
  refinementController.render();
  schedule();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else queueMicrotask(install);
