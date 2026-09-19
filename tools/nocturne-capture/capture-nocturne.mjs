import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const url = 'https://nocturne-autobattle.c-okamoto.workers.dev/';
const output = path.resolve('output');
fs.mkdirSync(output, { recursive: true });
const report = { url, width: 1920, height: 1080, fps: 30, frames: 900,
  capture: 'Native public-game rendering, frame-stepped original render loop at 30 Hz; no gameplay or asset changes',
  audio: false, startedAt: new Date().toISOString(), progress: [], errors: [] };
const browser = await chromium.launch({ headless: true, args: [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding'
] });
let encoder;
let page;
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1, locale: 'ja-JP' });
  page = await context.newPage();
  page.setDefaultTimeout(120000);
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.route('**/main.js', async route => {
    const response = await route.fetch();
    const source = await response.text();
    assert.ok(source.includes('function loop(now)') && source.includes('previous=performance.now()'));
    report.gameScriptSha256 = createHash('sha256').update(source).digest('hex');
    const instrumentation = '\nwindow.__NOCTURNE_CAPTURE__ = { stop: () => renderer.setAnimationLoop(null), step: () => loop(previous + 1000/30) };\n';
    await route.fulfill({ response, body: source + instrumentation });
  });
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => window.__NOCTURNE__?.metrics.ready && window.__NOCTURNE_CAPTURE__ &&
    document.getElementById('loader').classList.contains('hidden'), null, { timeout: 180000 });
  await page.evaluate(() => document.fonts.ready);
  const buildResponse = await page.request.get(new URL('build.json', url).href);
  report.build = await buildResponse.json();
  assert.equal(await page.locator('#quality').innerText(), '画質 高');
  assert.equal(await page.locator('#sound').innerText(), '音 OFF');
  await page.bringToFront();
  assert.equal(await page.evaluate(() => document.hidden), false);
  await page.evaluate(() => window.__NOCTURNE_CAPTURE__.stop());
  await page.locator('#start').click();
  await page.locator('[data-stance="balanced"]').click();
  for (let frame = 0; frame < 60; frame++) await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
    window.__NOCTURNE_CAPTURE__.step(); resolve();
  })));
  report.initial = await page.evaluate(() => window.__NOCTURNE__.metrics);
  assert.equal(report.initial.webgl2, true);
  assert.equal(report.initial.phase, 'battle');
  assert.ok(report.initial.time > 1.5, 'Game simulation must advance before capture');
  console.log('CAPTURE_READY', JSON.stringify(report.initial));
  const cdp = await context.newCDPSession(page);
  encoder = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'warning', '-y',
    '-f', 'image2pipe', '-framerate', '30', '-vcodec', 'mjpeg', '-i', 'pipe:0',
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-frames:v', '900', path.join(output, 'NOCTURNE_1080p_30s.mp4')],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const encoded = once(encoder, 'close');
  const unique = new Set();
  for (let frame = 0; frame < 900; frame++) {
    if (frame === 240) await page.locator('[data-stance="assault"]').click({ force: true });
    if (frame === 540) await page.locator('[data-stance="guard"]').click({ force: true });
    const frameTask = async () => {
      if (frame < 3) console.log('STEP_BEGIN', frame);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
        window.__NOCTURNE_CAPTURE__.step(); requestAnimationFrame(resolve);
      })));
      if (frame < 3) console.log('SCREENSHOT_BEGIN', frame);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 95,
        fromSurface: true, captureBeyondViewport: false });
      if (frame < 3) console.log('SCREENSHOT_DONE', frame);
      return Buffer.from(shot.data, 'base64');
    };
    let timeout;
    const bytes = await Promise.race([frameTask(), new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`Frame ${frame} stalled for 45 seconds`)), 45000);
    })]).finally(() => clearTimeout(timeout));
    unique.add(createHash('sha256').update(bytes).digest('hex'));
    if (!encoder.stdin.write(bytes)) await once(encoder.stdin, 'drain');
    if ([0, 449, 899].includes(frame)) fs.writeFileSync(path.join(output, `frame-${frame}.jpg`), bytes);
    if (frame % 30 === 0) {
      const state = await page.evaluate(() => window.__NOCTURNE__.metrics);
      report.progress.push({ frame, time: state.time, phase: state.phase, kills: state.kills });
      console.log('FRAME', frame, JSON.stringify(report.progress.at(-1)));
      assert.notEqual(state.phase, 'defeat');
      if (frame > 0) assert.ok(state.time > report.progress.at(-2).time, 'Game time must progress');
    }
  }
  encoder.stdin.end();
  const [code] = await encoded;
  assert.equal(code, 0, 'ffmpeg failed');
  report.uniqueFrames = unique.size;
  assert.ok(unique.size > 850, 'Capture must contain actual changing game frames');
  report.final = await page.evaluate(() => ({ metrics: window.__NOCTURNE__.metrics,
    trace: window.__NOCTURNE__.trace }));
  assert.ok(report.final.metrics.kills > report.initial.kills, 'Combat must progress during video');
  assert.deepEqual(report.errors, []);
  report.media = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams',
    '-show_format', '-of', 'json', path.join(output, 'NOCTURNE_1080p_30s.mp4')], { encoding: 'utf8' }));
  const video = report.media.streams.find(s => s.codec_type === 'video');
  assert.equal(video.width, 1920);
  assert.equal(video.height, 1080);
  assert.equal(Number(video.nb_frames), 900);
  assert.equal(Number(report.media.format.duration), 30);
  report.success = true;
  console.log('CAPTURE_SUCCESS', JSON.stringify({ uniqueFrames: unique.size,
    seconds: report.media.format.duration, final: report.final.metrics }));
} catch (error) {
  report.success = false;
  report.errors.push(String(error.stack || error));
  console.error(error);
  if (page) await page.screenshot({ path: path.join(output, 'failure.png'), timeout: 10000 }).catch(() => {});
  if (encoder) encoder.kill();
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'capture-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
