const $ = selector => document.querySelector(selector);
const canvas = $('#world');
const ctx = canvas.getContext('2d', { alpha: false });
const roomsRoot = $('#rooms');
const template = $('#room-template');
const counter = $('#room-counter');
const toast = $('#toast');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let items = [];
let roomNodes = [];
let targetProgress = 0;
let smoothProgress = 0;
let activeIndex = -1;
let toastTimer = null;
let width = 0;
let height = 0;
let dpr = 1;
let particles = [];

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

function domain(value) {
  try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

async function copyText(value, success = 'リンクをコピーしました') {
  try {
    await navigator.clipboard.writeText(value);
    showToast(success);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    showToast(ok ? success : 'コピーできませんでした');
    return ok;
  }
}

async function shareLink(title, url) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text: title, url });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  await copyText(url, '共有用リンクをコピーしました');
}

function actionButton(label, icon, className, handler) {
  const button = el('button', `room-action ${className || ''}`);
  button.type = 'button';
  button.append(el('span', 'icon', icon), el('span', '', label));
  button.addEventListener('click', handler);
  return button;
}

function renderRoom(item, index) {
  const fragment = template.content.cloneNode(true);
  const room = fragment.querySelector('.room');
  const previewFrame = fragment.querySelector('.preview-frame');
  const previewImage = fragment.querySelector('.preview-image');
  const previewVideo = fragment.querySelector('.preview-video');
  const preview = item.preview || {};
  const primary = (item.links || []).find(link => safeUrl(link.url));
  const primaryUrl = primary ? safeUrl(primary.url) : null;
  const accent = item.accent || '#8fb7ff';

  room.dataset.index = String(index);
  room.style.setProperty('--accent', accent);
  fragment.querySelector('.room-code').textContent = `${item.room || `ROOM ${String(index + 1).padStart(2, '0')}`} / ${String(index + 1).padStart(2, '0')}`;
  fragment.querySelector('.room-site').textContent = preview.siteName || domain(primaryUrl) || 'PUBLIC DESTINATION';
  fragment.querySelector('h2').textContent = item.title || preview.title || `DESTINATION ${index + 1}`;
  fragment.querySelector('.room-description').textContent = item.description || preview.description || '';
  fragment.querySelector('.preview-title').textContent = preview.title || item.title || '';
  fragment.querySelector('.preview-description').textContent = preview.description || item.description || '';
  fragment.querySelector('.preview-type').textContent = preview.type === 'video' ? 'VIDEO PREVIEW' : 'LIVE LINK PREVIEW';
  fragment.querySelector('.preview-domain').textContent = preview.siteName || domain(preview.url || primaryUrl);

  const imageUrl = safeUrl(preview.image);
  const videoUrl = safeUrl(preview.video);
  const directVideo = videoUrl && /\.(mp4|webm)(?:$|\?)/i.test(videoUrl);
  if (directVideo) {
    previewVideo.src = directVideo;
    previewVideo.addEventListener('canplay', () => {
      previewFrame.classList.add('has-video');
      if (room.classList.contains('is-active') && !reduceMotion) previewVideo.play().catch(() => {});
    }, { once: true });
  } else if (imageUrl) {
    previewImage.src = imageUrl;
    previewImage.alt = `${item.title || 'リンク先'} のプレビュー`;
    previewImage.addEventListener('load', () => previewFrame.classList.add('has-image'), { once: true });
    previewImage.addEventListener('error', () => previewFrame.classList.add('preview-fallback'), { once: true });
  } else {
    previewFrame.classList.add('preview-fallback');
  }

  const actions = fragment.querySelector('.room-actions');
  if (primaryUrl) {
    const open = el('a', 'room-action primary');
    open.href = primaryUrl;
    open.target = '_blank';
    open.rel = 'noreferrer';
    open.append(el('span', 'icon', '↗'), el('span', '', primary.label || 'OPEN'));
    actions.append(open);
    actions.append(actionButton('SHARE', '⇧', 'share', () => shareLink(item.title || preview.title || 'Link', primaryUrl)));
    actions.append(actionButton('COPY LINK', '⧉', 'copy', () => copyText(primaryUrl)));
  }

  for (const extra of (item.links || []).slice(1)) {
    const href = safeUrl(extra.url);
    if (!href) continue;
    const link = el('a', 'room-action secondary');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.append(el('span', 'icon', '↗'), el('span', '', extra.label || 'LINK'));
    actions.append(link);
  }
  return fragment;
}

function renderCatalog(data) {
  items = Array.isArray(data.items) ? data.items : [];
  roomsRoot.replaceChildren();
  if (data.degraded) showToast('PULSE同期に失敗したため、復旧入口を表示しています');
  if (!items.length) {
    const section = el('section', 'room loading-room');
    const stage = el('div', 'room-stage');
    stage.append(el('p', '', 'NO PUBLIC DESTINATIONS'));
    section.append(stage);
    roomsRoot.append(section);
    roomNodes = [];
    counter.textContent = '00 / 00';
    return;
  }
  items.forEach((item, index) => roomsRoot.append(renderRoom(item, index)));
  roomNodes = [...roomsRoot.querySelectorAll('.room[data-index]')];
  counter.textContent = `01 / ${String(items.length).padStart(2, '0')}`;
}

async function loadCatalog() {
  try {
    const response = await fetch(`/api/catalog?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderCatalog(await response.json());
  } catch (error) {
    try {
      const response = await fetch(`./catalog.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      renderCatalog(await response.json());
      showToast('PULSEへ接続できないため、復旧入口を表示しています');
    } catch {
      roomsRoot.innerHTML = '<section class="room loading-room"><div class="room-stage"><p>DIRECTORY OFFLINE</p></div></section>';
      counter.textContent = '00 / 00';
    }
  }
}

function resizeCanvas() {
  width = innerWidth;
  height = innerHeight;
  dpr = Math.min(devicePixelRatio || 1, 1.7);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const count = Math.max(48, Math.min(120, Math.round((width * height) / 16000)));
  particles = Array.from({ length: count }, (_, i) => ({
    x: ((i * 73.19) % 1000) / 1000,
    y: ((i * 193.7) % 1000) / 1000,
    z: ((i * 41.3) % 1000) / 1000,
    size: .4 + ((i * 29.7) % 100) / 90,
  }));
}

function hexRgb(hex = '#8fb7ff') {
  const value = hex.replace('#', '').trim();
  const normalized = value.length === 3 ? value.split('').map(x => x + x).join('') : value;
  const n = Number.parseInt(normalized, 16);
  if (!Number.isFinite(n)) return [143, 183, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function currentAccent() {
  return items[activeIndex]?.accent || '#8fb7ff';
}

function drawWorld(progress, time) {
  const [r, g, b] = hexRgb(currentAccent());
  const travel = progress * (Math.max(items.length, 1) + 2) * 11;
  const sway = Math.sin(travel * .16) * width * .025;
  const vx = width * .5 + sway;
  const vy = height * (.39 + Math.cos(travel * .08) * .015);

  const bg = ctx.createRadialGradient(vx, vy, 0, vx, vy, Math.max(width, height) * .9);
  bg.addColorStop(0, `rgba(${Math.round(r*.18)},${Math.round(g*.18)},${Math.round(b*.18)},1)`);
  bg.addColorStop(.42, '#090b11');
  bg.addColorStop(1, '#030408');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const p of particles) {
    const z = (p.z + travel * .018) % 1;
    const spread = .25 + z * 1.6;
    const x = vx + (p.x - .5) * width * spread;
    const y = vy + (p.y - .5) * height * spread;
    const alpha = .05 + z * .22;
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, p.size * (.4 + z * 1.6), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.lineWidth = 1;
  for (let i = 0; i < 22; i++) {
    const phase = ((i / 22) + travel * .045) % 1;
    const depth = phase * phase;
    const y = vy + (height - vy + 80) * depth;
    const half = width * (.06 + depth * .62);
    ctx.strokeStyle = `rgba(${r},${g},${b},${.025 + depth * .09})`;
    ctx.beginPath();
    ctx.moveTo(vx - half, y);
    ctx.lineTo(vx + half, y);
    ctx.stroke();
  }

  const railAlpha = .08 + Math.sin(time * .0005) * .015;
  for (const side of [-1, 1]) {
    for (let i = 1; i <= 5; i++) {
      const endX = width * .5 + side * width * (.12 + i * .11);
      const endY = height + 30;
      ctx.strokeStyle = `rgba(220,226,236,${railAlpha / i + .015})`;
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }

  const doorwayDepth = .22 + ((travel * .08) % 1) * .7;
  const doorW = width * (.08 + doorwayDepth * .4);
  const doorH = height * (.08 + doorwayDepth * .54);
  ctx.strokeStyle = `rgba(${r},${g},${b},${.09 + doorwayDepth * .12})`;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(vx - doorW / 2, vy - doorH * .33, doorW, doorH);

  const glow = ctx.createRadialGradient(vx, vy, 0, vx, vy, Math.min(width, height) * .42);
  glow.addColorStop(0, `rgba(${r},${g},${b},.09)`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function closestRoom() {
  if (!roomNodes.length) return -1;
  const center = innerHeight * .5;
  let best = -1;
  let bestDistance = Infinity;
  roomNodes.forEach((room, index) => {
    const rect = room.getBoundingClientRect();
    const distance = Math.abs((rect.top + rect.bottom) * .5 - center);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

function updateActiveRoom(next) {
  if (next === activeIndex) return;
  activeIndex = next;
  roomNodes.forEach((room, index) => {
    const active = index === activeIndex;
    room.classList.toggle('is-active', active);
    const video = room.querySelector('.preview-video');
    if (video?.src) {
      if (active && !reduceMotion) video.play().catch(() => {});
      else video.pause();
    }
  });
  if (activeIndex >= 0) counter.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
}

function tick(time) {
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  targetProgress = Math.min(1, Math.max(0, scrollY / max));
  smoothProgress += (targetProgress - smoothProgress) * (reduceMotion ? 1 : .085);
  document.documentElement.style.setProperty('--scroll', smoothProgress.toFixed(4));
  updateActiveRoom(closestRoom());
  drawWorld(smoothProgress, time);
  requestAnimationFrame(tick);
}

$('#share-page').addEventListener('click', () => shareLink('WAYFINDER — PULSE Public Paths', location.href));
$('#copy-page').addEventListener('click', () => copyText(location.href));
addEventListener('resize', resizeCanvas, { passive: true });
resizeCanvas();
loadCatalog();
requestAnimationFrame(tick);
