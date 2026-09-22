import {combatExchangeState} from './combat-exchange-state.js';

// The existing HUD owns update cadence and overlay lifecycle; no extra loop,
// subscription, input handler or timer is installed by this view.
export class CombatExchangeReadout {
  constructor(parent) {
    const doc = parent.ownerDocument;
    this.root = doc.createElement('section');
    this.root.id = 'combat-exchange-readout';
    this.root.hidden = true;
    this.root.setAttribute('aria-label', '交戦相手との生命と接触');
    this.rows = {};
    for (const side of ['hero', 'enemy']) {
      const row = doc.createElement('div'); row.className = 'exchange-vitals'; row.dataset.side = side;
      const name = doc.createElement('span'); name.className = 'exchange-name';
      const amount = doc.createElement('span'); amount.className = 'exchange-amount';
      const meter = doc.createElement('progress'); meter.max = 1; meter.value = 0;
      row.append(name, amount, meter); this.root.append(row);
      this.rows[side] = {name, amount, meter};
    }
    this.context = doc.createElement('small'); this.context.className = 'exchange-context';
    this.contact = doc.createElement('p'); this.contact.className = 'exchange-contact';
    this.contact.setAttribute('role', 'status'); this.contact.setAttribute('aria-atomic', 'true');
    this.root.append(this.context, this.contact); parent.append(this.root);
  }
  update(game, options) {
    const state = combatExchangeState(game, options);
    this.root.hidden = !state;
    if (!state) {
      this.contact.textContent = ''; this.root.dataset.contact = '';
      return;
    }
    for (const side of ['hero', 'enemy']) {
      const value = state[side], row = this.rows[side], amount = `${value.hp} / ${value.maxhp}`;
      if (row.name.textContent !== value.name) row.name.textContent = value.name;
      if (row.amount.textContent !== amount) row.amount.textContent = amount;
      row.meter.value = value.ratio;
      row.meter.setAttribute('aria-label', `${value.name}の生命 ${amount}`);
    }
    const context = `この相手との直近の接触${state.others ? ` · ほか${state.others}体が交戦中` : ''}`;
    if (this.context.textContent !== context) this.context.textContent = context;
    const copy = state.contact?.text || '直近の接触なし';
    if (this.contact.textContent !== copy) this.contact.textContent = copy;
    this.root.dataset.contact = state.contact?.direction || 'none';
  }
}
