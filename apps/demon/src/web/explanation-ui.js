const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

export function normalizeExplanationLocale(locale = 'ja') {
  const value = String(locale || 'ja').trim();
  return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value) ? value : 'ja';
}

export function renderExplanationCards(cards, { locale = 'ja' } = {}) {
  if (!Array.isArray(cards)) throw new TypeError('cards must be an array');
  const lang = normalizeExplanationLocale(locale);
  const body = cards.map((card, index) => {
    const mark = escapeHtml(card?.mark ?? '・');
    const title = escapeHtml(card?.title ?? '');
    const text = escapeHtml(card?.body ?? '');
    const note = card?.note ? `<small class="explanation-card__note">${escapeHtml(card.note)}</small>` : '';
    const depth = index % 2 === 0 ? 'left' : 'right';
    return `<article class="explanation-card" role="listitem" data-depth="${depth}">
      <div class="explanation-card__face">
        <header class="explanation-card__heading">
          <span class="explanation-card__mark" aria-hidden="true">${mark}</span>
          <h3>${title}</h3>
        </header>
        <p class="explanation-card__body">${text}</p>
        ${note}
      </div>
    </article>`;
  }).join('');
  return `<div class="explanation-grid" role="list" lang="${escapeHtml(lang)}">${body}</div>`;
}
