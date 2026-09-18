import { SAVE_KEY } from '@soul/raid/profile';

// One writer for the entire profile lifetime: locking only claim() allowed a
// second tab's equipment/reward save to overwrite an irreversible visit.
export async function createExclusiveProfileStorage(environment) {
  if (!navigator.locks) throw new Error('入村記録を保護するため、Web Locks対応ブラウザで開いてください。');
  const review = import.meta.env.DEV && new URLSearchParams(location.search).has('review');
  const key = `soul:v1:${environment}:demon:guest:${SAVE_KEY}${review ? ':review' : ''}`;
  let release;
  const lifetime = new Promise(resolve => { release = resolve; });
  await new Promise((resolve, reject) => {
    navigator.locks.request(key, { ifAvailable: true }, async lock => {
      if (!lock) { reject(new Error('別のタブで狩りを開いています。そのタブを閉じて再試行してください。')); return; }
      resolve();
      await lifetime;
    }).catch(reject);
  });
  // BFCache restoration must acquire the lock again before another write.
  let active = true;
  addEventListener('pagehide', () => { active = false; release(); }, { once: true });
  addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  const assertActive = () => { if (!active) throw new Error('保存セッションが終了しました。再読み込みしてください。'); };
  return {
    getItem() { assertActive(); return localStorage.getItem(key); },
    setItem(_, value) { assertActive(); localStorage.setItem(key, value); },
  };
}
