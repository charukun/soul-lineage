import './review-camera-menu.css';

const make = (tag, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

export function createReviewCameraMenu({
  host,
  label = '視点',
  groups = [],
  onSelect = () => {},
} = {}) {
  if (!host) throw new Error('Review camera menu requires a host element');

  const root = make('details', 'review-camera-menu');
  const summary = make('summary', 'review-camera-menu__toggle', label);
  summary.setAttribute('aria-label', `${label}メニュー`);
  root.append(summary);

  const panel = make('div', 'review-camera-menu__panel');
  panel.setAttribute('aria-label', `${label}の操作`);
  root.append(panel);

  const buttons = new Map();
  for (const group of groups) {
    const section = make('section', 'review-camera-menu__group');
    section.dataset.cameraGroup = group.id;
    const title = make('span', 'review-camera-menu__label', group.label || '');
    if (group.label) section.append(title);
    const options = make('div', 'review-camera-menu__options');
    for (const option of group.options || []) {
      const button = make('button', '', option.label);
      button.type = 'button';
      button.dataset.cameraOption = option.id;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => onSelect(group.id, option.id));
      options.append(button);
      buttons.set(`${group.id}:${option.id}`, button);
    }
    section.append(options);
    panel.append(section);
  }

  const onPointerDown = event => {
    if (root.open && !root.contains(event.target)) root.open = false;
  };
  const onKeyDown = event => {
    if (event.key === 'Escape' && root.open) {
      root.open = false;
      summary.focus();
    }
  };
  document.addEventListener('pointerdown', onPointerDown, true);
  root.addEventListener('keydown', onKeyDown);
  host.append(root);

  return {
    root,
    setSelected(groupId, optionId) {
      for (const [key, button] of buttons) {
        if (!key.startsWith(`${groupId}:`)) continue;
        button.setAttribute('aria-pressed', String(key === `${groupId}:${optionId}`));
      }
    },
    clearSelected(groupId) {
      for (const [key, button] of buttons) {
        if (key.startsWith(`${groupId}:`)) button.setAttribute('aria-pressed', 'false');
      }
    },
    close() { root.open = false; },
    destroy() {
      document.removeEventListener('pointerdown', onPointerDown, true);
      root.remove();
    },
  };
}
