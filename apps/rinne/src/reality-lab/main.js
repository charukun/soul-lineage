import { RealityExperiment } from '../game/reality-lab/engine.js';
import { DEFAULTS, MODEL_VERSION, MODES, normalizeConfig, STEP_MS } from '../game/reality-lab/config.js';
import { createReport, discussionText, readReport } from '../game/reality-lab/report.js';
import { drawWorld, renderResults, renderEvents, worldCaption } from './view.js';

const $ = id => document.getElementById(id), build = __BUILD_INFO__;
const key = `soul:rrp-lab:v1:${build.environment}:experiments`;
let models = [], completed = null, runConfig = null, runHypothesis = '', token = 0, running = false;
const notify = text => { $('status').textContent = text; };
const numeric = ['seed', 'peers', 'durationMs', 'latencyMs', 'jitterMs'];
function getConfig() {
  const config = Object.fromEntries(numeric.map(k => [k, Number($(k).value)]));
  return normalizeConfig({ ...config, layout: $('layout').value, scenario: $('scenario').value, loss: Number($('loss').value) / 100 });
}
function setConfig(config) {
  for (const k of [...numeric, 'layout', 'scenario']) $(k).value = config[k];
  $('loss').value = config.loss * 100;
}
function buttons() {
  $('conditions').disabled = running; $('hypothesis').disabled = running;
  for (const id of ['compare', 'play']) $(id).disabled = running;
  $('stop').disabled = !running; $('import').disabled = running;
  for (const id of ['save', 'export', 'discussion']) $(id).disabled = running || !completed;
}
function redraw() {
  const m = models.find(model => model.mode === $('view-mode').value);
  drawWorld($('world'), m); if (m) $('world-state').textContent = worldCaption(m);
}
function report() {
  if (!completed) throw Error('先に比較を完了してください。');
  return createReport({ config: runConfig, results: completed, hypothesis: runHypothesis, observation: $('observation').value, build, createdAt: new Date().toISOString() });
}
function updateUrl(config) {
  const url = new URL(location.href);
  url.searchParams.set('config', JSON.stringify(config)); history.replaceState(null, '', url);
}
function start(slow = false) {
  if (!$('experiment-form').reportValidity()) return;
  try {
    runConfig = getConfig(); runHypothesis = $('hypothesis').value; updateUrl(runConfig);
    models = Object.keys(MODES).map(mode => new RealityExperiment(runConfig, mode));
    completed = null; running = true; const run = ++token; buttons();
    $('results').textContent = '比較中…'; $('events').replaceChildren(); $('progress').value = 0; $('handoff').hidden = true;
    let last = 0;
    const frame = now => {
      if (token !== run) return;
      try {
        if (!document.hidden && (!slow || now - last >= STEP_MS)) {
          last = now;
          const until = performance.now() + 10;
          for (let i = 0; i < (slow ? 1 : 12); i += 1) {
            for (const model of models) model.step();
            if (performance.now() >= until) break;
          }
          $('progress').value = models[0].now / runConfig.durationMs; redraw();
        }
        if (models[0].now < runConfig.durationMs) { requestAnimationFrame(frame); return; }
        completed = models.map(m => m.result()); running = false; buttons();
        renderResults($('results'), completed); renderEvents($('events'), models);
        const stopped = completed.filter(r => r.phase !== 'open').length;
        notify(stopped ? `比較完了。${stopped}方式で復旧できず停止。結果とCheckpoint条件を確認してください。` : '比較完了。停止・誤差も見ながら、観察を記録してください。');
      } catch (error) { running = false; completed = null; buttons(); notify(`実験失敗：${error.message}`); }
    };
    notify(slow ? '実験を再生中。表示する方式を切り替えられます。' : '同じ条件で3方式を比較中…'); requestAnimationFrame(frame);
  } catch (error) { notify(error.message); }
}
function storedReports() {
  const data = JSON.parse(localStorage.getItem(key) || '[]');
  if (!Array.isArray(data) || data.length > 10) throw Error('記録の形式が不正です。');
  return data.map(r => readReport(JSON.stringify(r)));
}
function loadConditions(r) {
  if (running) { notify('実験を中止してから条件を読み込んでください。'); return; }
  setConfig(r.config); $('hypothesis').value = r.hypothesis; $('observation').value = r.observation;
  completed = null; buttons(); $('results').textContent = '条件を読み込みました。比較を再実行してください。';
  $('events').replaceChildren(); $('handoff').hidden = true; $('progress').value = 0;
  models = Object.keys(MODES).map(mode => new RealityExperiment(r.config, mode)); redraw();
  const source = String(r.build?.commit || '不明');
  notify(`条件を復元しました。記録元 ${source.slice(0, 12)}${source !== build.commit ? '（現在とコード版が違います）' : ''}。比較ボタンで現在のコードを再実行します。`);
}
function historyList() {
  $('history').replaceChildren();
  try {
    for (const r of storedReports()) {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = `${r.hypothesis || '仮説未記入'} — 条件を戻す`;
      const small = document.createElement('small'); small.textContent = `${String(r.createdAt)} · seed ${r.config.seed} · ${r.config.peers}人 · ${String(r.build?.commit || '').slice(0, 8)}`;
      button.append(small); button.addEventListener('click', () => loadConditions(r)); $('history').append(button);
    }
  } catch (error) { notify(`端末内記録を読めません：${error.message}。比較とJSON出力は利用できます。`); }
}
function save() {
  try {
    const r = report(), existing = storedReports();
    localStorage.setItem(key, JSON.stringify([r, ...existing].slice(0, 10)));
    historyList(); notify('この端末に記録しました。過去の記録から条件を戻せます。');
  } catch (error) { notify(`保存できません：${error.message}。結果JSONを使ってください。`); }
}
function download() {
  try {
    const r = report(), blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `rrp-${r.config.seed}-${r.config.scenario}-${build.commit.slice(0, 8)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { notify(error.message); }
}
async function discussion() {
  try {
    const text = discussionText(report()); $('handoff').value = text; $('handoff').hidden = false;
    try { await navigator.clipboard.writeText(text); notify('議論用テキストをコピーしました。この会話に貼って次の仮説を検討できます。'); }
    catch { $('handoff').focus(); $('handoff').select(); notify('下のテキストをコピーして、この会話へ渡してください。'); }
  } catch (error) { notify(error.message); }
}
async function importReport(event) {
  try {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 500000) throw Error('500KB以下の結果JSONを選んでください。');
    loadConditions(readReport(await file.text()));
  } catch (error) { notify(`読み込めません：${error.message}`); }
  finally { event.target.value = ''; }
}

$('experiment-form').addEventListener('submit', e => { e.preventDefault(); start(); });
$('play').addEventListener('click', () => start(true));
$('stop').addEventListener('click', () => { token += 1; running = false; completed = null; buttons(); notify('実験を中止しました。完了結果としては保存しません。'); });
$('view-mode').addEventListener('change', redraw);
$('save').addEventListener('click', save); $('export').addEventListener('click', download);
$('discussion').addEventListener('click', discussion); $('import').addEventListener('change', importReport);
$('version').textContent = `${MODEL_VERSION} · ${build.environment} · ${build.commit.slice(0, 12)}`;
historyList();
try { const raw = new URLSearchParams(location.search).get('config'); if (raw) setConfig(normalizeConfig(JSON.parse(raw))); }
catch { notify('URLの条件が不正なため、既定条件を使います。'); setConfig(DEFAULTS); }
models = Object.keys(MODES).map(mode => new RealityExperiment(getConfig(), mode)); redraw();
if (import.meta.hot) import.meta.hot.dispose(() => { token += 1; });
