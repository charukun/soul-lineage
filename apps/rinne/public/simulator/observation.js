/** Display-only adapter. Never changes techniques, age, combat, or the balance editor. */
export function installObservation(doc = document) {
  if (doc.getElementById('observation-style')) return;
  const style = doc.createElement('style');
  style.id = 'observation-style';
  style.textContent = `
    body[data-observation="compact"] #battleReadout .recipe-caption,
    body[data-observation="compact"] #battleReadout .hud-effects,
    body[data-observation="compact"] #battleReadout .hud-composition,
    body[data-observation="compact"] #battleReadout .art-en,
    body[data-observation="compact"] #defenseReadout .art-en,
    body[data-observation="compact"] #defenseRecent .previous{display:none!important}
    body[data-observation="compact"] #battleReadout{width:220px}
    body[data-observation="compact"] #defenseReadout{width:190px}
    .observation-setting{display:flex;align-items:center;gap:12px;min-height:44px;padding:8px 0;font-size:12px}
    .observation-setting input{width:20px;height:20px}
    #observation-note{font-size:11px;line-height:1.7;color:#afc0b7}
    .arena-dock button{min-width:44px;min-height:44px}
  `;
  doc.head.append(style);
  // It is a device display preference, not a gameplay save/schema change.
  const environment = new URL(doc.defaultView.location.href).searchParams.get('environment') || 'local';
  const key = `rinne.${environment}.observation.v1`;
  let detailed = false;
  try { detailed = doc.defaultView.localStorage.getItem(key) === 'detailed'; } catch {}
  const label = doc.createElement('label');
  label.className = 'observation-setting';
  const toggle = doc.createElement('input');
  toggle.type = 'checkbox';toggle.id = 'observation-details';toggle.checked = detailed;
  label.append(toggle, '戦闘画面に技の詳細を表示');
  const note = doc.createElement('p');note.id = 'observation-note';
  note.textContent = '通常は技名と序・破・急を表示。技の構成・効果は設定画面で確認できます。';
  const apply = () => { doc.body.dataset.observation = toggle.checked ? 'detailed' : 'compact'; };
  toggle.addEventListener('change', () => { apply();try { doc.defaultView.localStorage.setItem(key, doc.body.dataset.observation); } catch {} });
  doc.getElementById('panel-settings')?.prepend(label, note);
  apply();
}
