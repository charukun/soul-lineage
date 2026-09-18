const SIDES = new Set(['left','right']);
const VARIANTS = new Set(['normal','compact']);

export function normaliseGuideOptions(input = {}) {
  return {
    side: SIDES.has(input.side) ? input.side : 'right',
    variant: VARIANTS.has(input.variant) ? input.variant : 'normal',
    kicker: String(input.kicker || ''),
    title: String(input.title || ''),
    body: String(input.body || '')
  };
}

function element(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

export function createAngledGuide(root, options = {}) {
  if (!root) return null;
  let state = normaliseGuideOptions(options), hideTimer = 0;
  const panel = element('div', 'angled-guide__panel');
  const kicker = element('small', 'angled-guide__kicker');
  const title = element('strong', 'angled-guide__title');
  const body = element('span', 'angled-guide__body');
  panel.append(kicker, title, body);

  let close = null;
  if (options.closable) {
    close = element('button', 'angled-guide__close');
    close.type = 'button';
    close.setAttribute('aria-label', '閉じる');
    close.textContent = '×';
    panel.append(close);
  }

  root.classList.add('angled-guide');
  root.replaceChildren(panel);

  function apply(next = {}) {
    if (Object.hasOwn(next, 'side')) state.side = SIDES.has(next.side) ? next.side : 'right';
    if (Object.hasOwn(next, 'variant')) state.variant = VARIANTS.has(next.variant) ? next.variant : 'normal';
    if (Object.hasOwn(next, 'kicker')) state.kicker = String(next.kicker || '');
    if (Object.hasOwn(next, 'title')) state.title = String(next.title || '');
    if (Object.hasOwn(next, 'body')) {
      state.body = String(next.body || '');
      body.replaceChildren(document.createTextNode(state.body));
    }
    root.dataset.side = state.side;
    root.dataset.variant = state.variant;
    kicker.textContent = state.kicker;
    kicker.hidden = !state.kicker;
    title.textContent = state.title;
    title.hidden = !state.title;
  }

  function show(next = {}) {
    apply(next);
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = 0; }
    const opening = root.hidden;
    root.hidden = false;
    if (opening) {
      root.classList.remove('is-visible');
      requestAnimationFrame(() => { if (!root.hidden) root.classList.add('is-visible'); });
    } else root.classList.add('is-visible');
  }

  function hide({immediate = false} = {}) {
    const visible = root.classList.contains('is-visible');
    if (root.hidden) return;
    if (!visible) {
      if (immediate) root.hidden = true;
      return;
    }
    root.classList.remove('is-visible');
    if (hideTimer) clearTimeout(hideTimer);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (immediate || reduced) { root.hidden = true; hideTimer = 0; return; }
    hideTimer = window.setTimeout(() => { if (!root.classList.contains('is-visible')) root.hidden = true; hideTimer = 0; }, 190);
  }

  function setBodyNodes(...nodes) {
    state.body = '';
    body.replaceChildren(...nodes.filter(Boolean));
  }

  close?.addEventListener('click', () => {
    hide();
    options.onClose?.();
  });

  apply(state);
  return {show, hide, apply, setBodyNodes, elements:{panel,kicker,title,body,close}};
}
