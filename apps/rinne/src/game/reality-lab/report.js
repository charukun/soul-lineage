import { MODEL_VERSION, normalizeConfig, MODES, SCENARIOS } from './config.js';

export function createReport({ config, results, hypothesis = '', observation = '', build = {}, createdAt = '' }) {
  if (results.length !== 3 || new Set(results.map(r => r.mode)).size !== 3 || results.some(r => !Object.hasOwn(MODES, r.mode))) throw Error('比較が完了していません。');
  return { format: MODEL_VERSION, repository: 'charukun/soul-lineage', createdAt,
    build: { commit: String(build.commit || 'UNBUILT'), inputHash: String(build.inputHash || ''), environment: String(build.environment || 'local') },
    hypothesis: String(hypothesis).slice(0, 2000), observation: String(observation).slice(0, 2000), config: normalizeConfig(config), results,
    evidence: { transport: 'seeded in-process datagram model', clock: 'virtual 50ms steps', bytes: 'serialized JSON payload, excluding protocol overhead',
      coordinator: 'single trusted local model; cell clock/report traffic counted, not distributed consensus',
      movement: 'scripted autonomous actors; no player-input transport or collision/combat',
      unmeasured: ['WebRTC', 'NAT', 'TURN', 'uplink congestion', 'CPU', 'RAM', 'battery', 'browser suspension', 'security', 'cloud persistence'] } };
}

export function readReport(text) {
  if (typeof text !== 'string' || text.length > 500000) throw Error('結果ファイルは500KB以下にしてください。');
  const r = JSON.parse(text);
  if (r?.format !== MODEL_VERSION || !r.config || !Array.isArray(r.results) || r.results.length !== 3) throw Error('この版のRRP実験結果ではありません。');
  if (r.results.some(x => !x || !Object.hasOwn(MODES, x.mode) || !Number.isFinite(x.payloadBytes))) throw Error('結果の形式が不正です。');
  if (new Set(r.results.map(x => x.mode)).size !== 3) throw Error('比較方式が重複しています。');
  return { ...r, config: normalizeConfig(r.config), hypothesis: String(r.hypothesis || '').slice(0, 2000), observation: String(r.observation || '').slice(0, 2000) };
}

export function discussionText(report) {
  const rows = report.results.map(r => `${MODES[r.mode]}: payload ${(r.payloadBytes / 1000).toFixed(1)} kB / Primary平均 ${r.primaryKbps.toFixed(2)} kB/s / 最大端末平均 ${r.maxPeerKbps.toFixed(2)} kB/s / 停止 ${r.darkMs}ms / 巻戻し ${r.rollbackMs}ms / 不一致 ${r.invalid} / 再同期 ${r.repairs} / 最終 ${r.phase}`);
  return [
    '輪廻転焦 RRP Labの結果を元に、次の仮説を一つ決めてください。まだ本編へ適用しないでください。',
    `Repository: ${report.repository}`, `計測元commit: ${report.build?.commit || '不明'} / model: ${report.format}`,
    '計測元SHAはこの実験の出典です。実装変更時の正本はその時点の最新developです。',
    `仮説: ${report.hypothesis || '未記入'}`, `観察: ${report.observation || '未記入'}`,
    `条件: ${JSON.stringify(report.config)}`, `シナリオ: ${SCENARIOS[report.config.scenario]}`, ...rows,
    '単一端末の仮想時間・模擬通信です。payloadと計算回数の比較であり、実WebRTC/NAT/TURN・CPU/RAM・電池・不正耐性・クラウド永続化の実証ではありません。',
    '確認事項: 1. この結果が仮説を支持する範囲 2. 模型の省略に依存する結論 3. 次に一変数だけ変える実験 4. 必要なら最小の計測追加。',
  ].join('\n');
}
