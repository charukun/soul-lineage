const byId = id => document.getElementById(id);

export class AngledGuide {
  constructor(root = byId('angled-guide')) {
    this.root = root;
    this.kicker = root?.querySelector('[data-guide-kicker]');
    this.title = root?.querySelector('[data-guide-title]');
    this.body = root?.querySelector('[data-guide-body]');
    this.close = root?.querySelector('[data-guide-close]');
    this.timer = 0;
    this.token = 0;
    this.close?.addEventListener('click', () => this.hide());
  }

  show({side = 'right', kicker = '', title = '', body = '', variant = 'normal', duration = 0} = {}) {
    if (!this.root) return;
    window.clearTimeout(this.timer);
    this.token += 1;
    this.root.dataset.side = side === 'left' ? 'left' : 'right';
    this.root.dataset.variant = variant === 'compact' ? 'compact' : 'normal';
    this.kicker.textContent = kicker;
    this.title.textContent = title;
    this.body.replaceChildren();
    for (const line of Array.isArray(body) ? body : [body]) {
      if (!line) continue;
      const row = document.createElement('p');
      if (typeof line === 'string') row.textContent = line;
      else {
        const strong = document.createElement('strong');
        strong.textContent = line.label || '';
        const span = document.createElement('span');
        span.textContent = line.text || '';
        row.append(strong, span);
      }
      this.body.append(row);
    }
    this.root.hidden = false;
    this.root.setAttribute('aria-hidden', 'false');
    if (duration > 0) {
      const token = this.token;
      this.timer = window.setTimeout(() => {
        if (token === this.token) this.hide();
      }, duration);
    }
  }

  hide() {
    if (!this.root) return;
    window.clearTimeout(this.timer);
    this.token += 1;
    this.root.hidden = true;
    this.root.setAttribute('aria-hidden', 'true');
  }

  get visible() {
    return !!this.root && !this.root.hidden;
  }
}
