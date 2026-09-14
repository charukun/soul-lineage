import './character-art-qa.css';
import { stylizedArtAudit, compareStylizedSilhouettes } from '@soul/rendering/stylized-art';
import { productionArtProfileForActorId } from '@soul/rendering/master-character-production';

const el = id => document.getElementById(id);
const text = (tag, value, className = '') => { const node = document.createElement(tag); node.textContent = value; node.className = className; return node; };
const worstGate = gates => gates.includes('fail') ? 'fail' : gates.includes('review') ? 'review' : 'pass';
const formatNumber = value => Number.isFinite(value) ? Math.round(value).toLocaleString() : '-';

function actorAudit(actor, review = window.masterCharacterReview) {
  if (!actor?.root) return null;
  const profileId = actor.root.userData?.stylizedArt?.profileId || productionArtProfileForActorId(actor.id);
  const body = stylizedArtAudit(actor.root, profileId);
  const attachments = actor.attachments?.children?.length ? stylizedArtAudit(actor.attachments, profileId) : null;
  const totalTriangles = body.triangles + (attachments?.triangles ?? 0);
  const totalMaterials = body.materials + (attachments?.materials ?? 0);
  const warnings = [...body.warnings];
  const errors = [...body.errors];
  for (const value of attachments?.warnings ?? []) warnings.push(`attachment: ${value}`);
  for (const value of attachments?.errors ?? []) if (value !== 'silhouette envelope is invalid') errors.push(`attachment: ${value}`);
  if (totalTriangles > body.budget.softTriangleBudget) warnings.push(`character + equipment triangles ${totalTriangles.toLocaleString()} > soft budget ${body.budget.softTriangleBudget.toLocaleString()}`);
  if (totalMaterials > body.budget.softMaterialBudget) warnings.push(`character + equipment materials ${totalMaterials} > soft budget ${body.budget.softMaterialBudget}`);

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
  return { id: actor.id, profileId, body, attachments, totalTriangles, totalMaterials, warnings, errors, hero, gate };
}

function metricCard(label, id) {
  const card = text('div', '', 'art-qa-card');
  card.append(text('b', label));
  const output = document.createElement('output'); output.id = id; card.append(output); return card;
}

function install() {
  const panel = el('panel-qa'), review = window.masterCharacterReview;
  if (!panel || !review || el('art-qa')) return;
  const tab = el('tab-qa'); if (tab) tab.textContent = '品質QA';
  const section = text('section', '', 'art-qa'); section.id = 'art-qa'; section.setAttribute('aria-label', '美術・負荷QA');
  const head = text('div', '', 'art-qa-head'); head.append(text('h2', 'Art / Performance QA'));
  const gate = text('span', '準備中', 'art-gate'); gate.id = 'art-qa-gate'; head.append(gate); section.append(head);
  const grid = text('div', '', 'art-qa-grid');
  grid.append(metricCard('Profile', 'art-qa-profile'), metricCard('Triangles', 'art-qa-triangles'), metricCard('Materials', 'art-qa-materials'), metricCard('LOD', 'art-qa-lod'), metricCard('Silhouette', 'art-qa-silhouette'), metricCard('Frame', 'art-qa-frame'));
  section.append(grid);
  const actions = text('div', '', 'art-qa-actions');
  const selected = text('button', '選択個体を再監査'); selected.type = 'button'; selected.id = 'art-qa-selected';
  const cohort = text('button', '全個体シルエット比較'); cohort.type = 'button'; cohort.id = 'art-qa-cohort';
  const front = text('button', '正面で確認'); front.type = 'button'; front.addEventListener('click', () => review.aim?.('front'));
  const side = text('button', '横で確認'); side.type = 'button'; side.addEventListener('click', () => review.aim?.('side'));
  actions.append(selected, cohort, front, side); section.append(actions);
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
    if (!audit) { renderPerf(); return; }
    const body = audit.body;
    el('art-qa-profile').textContent = audit.profileId === 'hero' ? 'hero · SHINO GATE' : audit.profileId;
    el('art-qa-triangles').textContent = `${formatNumber(audit.totalTriangles)} / soft ${formatNumber(body.budget.softTriangleBudget)}`;
    el('art-qa-materials').textContent = `${audit.totalMaterials} / soft ${body.budget.softMaterialBudget}`;
    el('art-qa-lod').textContent = `${body.lod.installed}/${body.lod.eligible} mesh`;
    const s = body.silhouette;
    el('art-qa-silhouette').textContent = s.valid ? `前 ${s.frontAspect.toFixed(2)} / 横 ${s.sideAspect.toFixed(2)} / 3/4 ${s.diagonalAspect.toFixed(2)}` : '未取得';
    renderPerf();
    gate.textContent = audit.gate.toUpperCase(); gate.dataset.gate = audit.gate;
    const heroLine = audit.hero ? [`HERO Visual Approval: ${audit.hero.visualApproval}`] : [];
    report.textContent = audit.errors.length || audit.warnings.length ? [...heroLine, ...audit.errors.map(v => `ERROR ${v}`), ...audit.warnings.map(v => `WARN ${v}`)].join('\n') : [...heroLine, '共有Material token・形状予算・LOD・シルエットの自動監査で問題なし。'].join('\n');
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
  window.__CHARACTER_ART_QA__ = Object.freeze({ selected: renderSelected, cohort: renderCohort, actorAudit: actor => actorAudit(actor, review) });
  schedule();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else queueMicrotask(install);
