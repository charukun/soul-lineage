const $ = selector => document.querySelector(selector);
const template = $('#card-template');
const cardsRoot = $('#cards');
const countRoot = $('#live-count');
let catalog = [];
let currentFilter = 'all';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
};

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function makeCard(item) {
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector('.portal-card');
  card.dataset.category = item.category || 'other';
  card.dataset.id = item.id || '';
  card.classList.add(`accent-${item.accent || 'graphite'}`);
  if (item.featured) card.classList.add('featured');

  fragment.querySelector('.card-eyebrow').textContent = item.eyebrow || item.category || 'PUBLIC';
  fragment.querySelector('h2').textContent = item.title || item.id || 'Untitled';
  fragment.querySelector('.card-description').textContent = item.description || '';

  const tags = fragment.querySelector('.card-tags');
  for (const tag of item.tags || []) tags.append(el('span', '', tag));

  const links = fragment.querySelector('.card-links');
  for (const itemLink of item.links || []) {
    const href = safeUrl(itemLink.url);
    if (!href) continue;
    const anchor = el('a', `card-link ${itemLink.tone === 'primary' ? 'primary' : ''}`, `${itemLink.label || '開く'} ↗`);
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    links.append(anchor);
  }
  return fragment;
}

function render() {
  cardsRoot.replaceChildren();
  const visible = currentFilter === 'all' ? catalog : catalog.filter(item => item.category === currentFilter);
  if (!visible.length) {
    cardsRoot.append(el('p', 'empty-state', 'このカテゴリには公開項目がありません。'));
    return;
  }
  for (const item of visible) cardsRoot.append(makeCard(item));
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter').forEach(button => {
    const active = button.dataset.filter === filter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  render();
}

async function load() {
  try {
    const response = await fetch(`../catalog.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    catalog = Array.isArray(data.items) ? data.items : [];
    const liveItems = catalog.filter(item => item.category !== 'source');
    const liveLinks = liveItems.flatMap(item => item.links || []).filter(link => link.verify).length;
    countRoot.textContent = `${liveItems.length} PUBLIC ITEMS / ${liveLinks} VERIFIED LINKS`;
    render();
  } catch (error) {
    cardsRoot.replaceChildren(el('p', 'empty-state', `公開ディレクトリを読み込めませんでした: ${error.message}`));
    countRoot.textContent = 'DIRECTORY ERROR';
  }
}

document.querySelectorAll('.filter').forEach(button => {
  button.addEventListener('click', () => setFilter(button.dataset.filter || 'all'));
});

load();
