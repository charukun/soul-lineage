import './character-reference-workshop.css';
import { CHARACTER_REFERENCE_ARCHETYPES, VISUAL_ROLES } from '@soul/characters';

const el = id => document.getElementById(id);
const make = (tag, text = '', className = '') => { const node = document.createElement(tag); node.textContent = text; node.className = className; return node; };

function listBlock(title, rows, className) {
  const section = make('section', '', `reference-coverage ${className}`);
  section.append(make('h4', title));
  const list = document.createElement('ul');
  (rows.length ? rows : ['なし']).forEach(row => list.append(make('li', row)));
  section.append(list); return section;
}

function build() {
  const panel = el('panel-compare');
  if (!panel || el('reference-archetype-panel')) return;
  const host = make('section', '', 'reference-archetype-panel'); host.id = 'reference-archetype-panel';
  const heading = make('div', '', 'panel-heading');
  heading.append(make('h3', 'キャラクターリファレンス'));
  const state = make('span', '自由生成', 'scope-label'); state.id = 'reference-archetype-state'; heading.append(state); host.append(heading);
  host.append(make('p', '参照を選ぶと、その設計目標に合わせて既存の実装済みパーツ・年齢・役割を使い、1 / 6 / 12 / 30体を再生成できます。画像だけの要素は自動実装しません。', 'hint'));
  const grid = make('div', '', 'reference-archetype-grid'); grid.id = 'reference-archetype-grid';
  const free = make('button', '自由生成', 'reference-archetype-card reference-free'); free.type = 'button'; free.dataset.referenceArchetype = 'mixed';
  free.addEventListener('click', () => window.characterStudio?.workspace.selectArchetype('mixed')); grid.append(free);
  for (const row of Object.values(CHARACTER_REFERENCE_ARCHETYPES)) {
    const card = make('button', '', 'reference-archetype-card'); card.type = 'button'; card.dataset.referenceArchetype = row.id;
    const img = document.createElement('img'); img.src = `./reference/npc-role-set/${row.assetFile}`; img.alt = `${row.label} キャラクターリファレンス`; img.loading = 'lazy';
    card.append(img, make('strong', row.label), make('small', `${row.age}歳 · ${VISUAL_ROLES[row.role] ?? row.role}`));
    card.addEventListener('click', () => window.characterStudio?.workspace.selectArchetype(row.id)); grid.append(card);
  }
  host.append(grid);
  const detail = make('div', '', 'reference-archetype-detail'); detail.id = 'reference-archetype-detail'; detail.hidden = true;
  const preview = document.createElement('img'); preview.id = 'reference-archetype-preview'; preview.alt = ''; preview.loading = 'lazy'; detail.append(preview);
  const copy = make('div', '', 'reference-archetype-copy');
  copy.append(make('h3', '', 'reference-archetype-title'), make('p', '', 'reference-archetype-meta'));
  const coverage = make('div', '', 'reference-coverage-grid'); coverage.id = 'reference-coverage-grid'; copy.append(coverage); detail.append(copy); host.append(detail);
  const quality = panel.querySelector('.quality-controls'); panel.insertBefore(host, quality ?? panel.firstChild);
}

function render() {
  build();
  const studio = window.characterStudio, host = el('reference-archetype-panel');
  if (!studio || !host) return;
  const quality = studio.workspace.quality, id = quality.archetype ?? 'mixed', target = id === 'mixed' ? null : CHARACTER_REFERENCE_ARCHETYPES[id];
  for (const card of host.querySelectorAll('[data-reference-archetype]')) card.setAttribute('aria-pressed', String(card.dataset.referenceArchetype === id));
  el('reference-archetype-state').textContent = target ? `${target.label} 目標` : '自由生成';
  const detail = el('reference-archetype-detail'); detail.hidden = !target;
  const role = el('quality-role'), age = el('quality-age'), shino = el('quality-reference');
  if (role) role.disabled = Boolean(target); if (age) age.disabled = Boolean(target); if (shino) shino.disabled = Boolean(target);
  if (!target) return;
  const preview = el('reference-archetype-preview'); preview.src = `./reference/npc-role-set/${target.assetFile}`; preview.alt = `${target.label} キャラクターリファレンス`;
  detail.querySelector('.reference-archetype-title').textContent = target.label;
  detail.querySelector('.reference-archetype-meta').textContent = `${target.age}歳 · ${VISUAL_ROLES[target.role] ?? target.role} · CONCEPT TARGET / PARTIALLY MAPPED`;
  const coverage = el('reference-coverage-grid'); coverage.replaceChildren(
    listBlock('IMPLEMENTED MODULAR PARTS', target.coverage.implementedModularParts, 'implemented'),
    listBlock('PROPOSED PARTS', target.coverage.proposedParts, 'proposed'),
    listBlock('GAME EQUIPMENT', target.coverage.gameEquipment, 'equipment')
  );
}

window.addEventListener('DOMContentLoaded', () => { build(); render(); });
window.addEventListener('character-workspace-change', render);
