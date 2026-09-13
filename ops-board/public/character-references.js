import { subscribe } from './view-state.js';

const $ = selector => document.querySelector(selector);
const fmt = new Intl.DateTimeFormat('ja-JP', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', timeZoneName:'short' });
const el = (tag, className = '', text = '') => { const node = document.createElement(tag); if (className) node.className = className; if (text !== '') node.textContent = text; return node; };
const safeHref = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };
const time = value => { const date = new Date(value || 0); return Number.isNaN(date.getTime()) ? '未記録' : fmt.format(date); };

function externalLink(label, href, className = '') {
  const node = el('a', className, label);
  const safe = safeHref(href);
  if (safe) { node.href = safe; node.target = '_blank'; node.rel = 'noreferrer'; }
  else node.setAttribute('aria-disabled', 'true');
  return node;
}

function assetCard(asset, primary = false) {
  const href = safeHref(asset?.url);
  const card = href ? document.createElement('a') : document.createElement('div');
  card.className = `reference-asset${primary ? ' primary' : ''}`;
  if (href) { card.href = href; card.target = '_blank'; card.rel = 'noreferrer'; }
  const frame = el('div', 'reference-image-frame');
  const image = document.createElement('img');
  image.loading = primary ? 'eager' : 'lazy';
  image.decoding = 'async';
  image.alt = asset?.name || 'Character reference';
  if (href) image.src = href;
  frame.append(image);
  const meta = el('div', 'reference-asset-meta');
  meta.append(el('strong', '', asset?.name || 'Reference image'));
  if (Number.isFinite(asset?.size) && asset.size > 0) meta.append(el('span', 'muted', `${Math.max(1, Math.round(asset.size / 1024))} KB`));
  card.append(frame, meta);
  return card;
}

function groupCard(group) {
  const article = el('article', 'reference-group card');
  article.dataset.viewKey = `reference:${group.id}`;
  const head = el('div', 'reference-group-head');
  const title = el('div');
  title.append(el('p', 'reference-kicker', group.id), el('h2', '', group.title || group.id));
  const actions = el('div', 'reference-actions');
  if (group.readmeUrl) actions.append(externalLink('README', group.readmeUrl));
  if (group.repositoryUrl) actions.append(externalLink('GitHub', group.repositoryUrl));
  head.append(title, actions);
  article.append(head);

  const assets = Array.isArray(group.assets) ? group.assets : [];
  article.append(el('p', 'reference-group-count muted', `${assets.length} image${assets.length === 1 ? '' : 's'}`));
  const grid = el('div', `reference-assets${assets.length === 1 ? ' single' : ''}`);
  assets.forEach((asset, index) => grid.append(assetCard(asset, index === 0)));
  if (!assets.length) grid.append(el('p', 'empty', '画像がありません'));
  article.append(grid);
  return article;
}

function render(state, error) {
  const root = $('#reference-groups');
  root.replaceChildren();
  const refs = state?.characterReferences;
  const groups = Array.isArray(refs?.groups) ? refs.groups : [];
  $('#reference-count').textContent = `${refs?.totalGroups ?? groups.length}セット / ${refs?.totalAssets ?? groups.reduce((sum, group) => sum + (group.assets?.length || 0), 0)}画像`;
  $('#reference-state').textContent = refs?.stale ? '前回取得したReferenceを表示中' : 'develop同期済み';
  $('#last-updated').textContent = `最終更新: ${time(state?.generatedAt)}`;
  $('#source').textContent = refs?.source ? `${refs.source} / ${refs.branch || 'develop'}` : 'PULSE同期データから取得';

  const freshness = $('#sync-freshness');
  freshness.textContent = error ? '更新失敗' : `最終取得 ${time(state?.generatedAt)}`;
  freshness.className = `sync-freshness ${error || refs?.stale ? 'warning' : 'info'}`;

  if (!groups.length) {
    const empty = el('div', 'card');
    empty.append(el('p', 'empty', error ? 'Reference一覧を更新できませんでした。前回データもありません。' : 'Reference画像を検出できませんでした。'));
    root.append(empty);
    return;
  }
  groups.forEach(group => root.append(groupCard(group)));
}

subscribe((state, error) => render(state, error));
