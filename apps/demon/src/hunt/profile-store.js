import {readProgress, settleProgress, buyUpgrade, chooseLifeSpecies, loseLifeProgress} from './balance.js';

// Extend the existing save transaction; visit history + reward commit together.
// Injecting the original class keeps these transaction contracts testable without browser storage.
export function withHuntProfile(BaseStore) {
  return class HuntProfileStore extends BaseStore {
    read() { const p = super.read(); readProgress(p); return p; }
    write(p) { readProgress(p); return super.write(p); }
    change(fn) {
      return super.change(p => {
        readProgress(p);
        const result = fn(p);
        if (this.huntSettlement && result === true) {
          const {status, eaten, report} = this.huntSettlement;
          const settled = settleProgress(p, status, eaten, report);
          if (status === 'defeated') loseLifeProgress(p, settled);
        }
        return result;
      });
    }
    finish(id, status, eaten, report) {
      if (this.huntSettlement) throw Error('狩りの結果は保存中です。');
      this.huntSettlement = {status, eaten, report};
      try { return super.finish(id, status, eaten); }
      finally { this.huntSettlement = null; }
    }
    upgrade(key) { return this.change(p => buyUpgrade(p, key)); }
    species(id) { return this.change(p => chooseLifeSpecies(p, id)); }
  };
}
