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
  capture: 'Native game rendering, frame-stepped browser clock; 30 seconds at original game speed',
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
  await page.clock.install({ time: new Date('2026-09-19T00:00:00Z') });
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => window.__NOCTURNE__?.metrics.ready &&
    document.getElementById('loader').classList.contains('hidden'), null, { timeout: 180000 });
  await page.evaluate(() => document.fonts.ready);
  const buildResponse = await page.request.get(new URL('build.json', url).href);
  report.build = await buildResponse.json();
  assert.equal(await page.locator('#quality').innerText(), '画質 高');
  assert.equal(await page.locator('#sound').innerText(), '音 OFF');
  await page.locator('#start').click();
  await page.locator('[data-stance="balanced"]').click();
  const pauseTime = await page.evaluate(() => Date.now() + 1000);
  await page.clock.pauseAt(pauseTime);
  await page.clock.runFor(2000);
  report.initial = await page.evaluate(() => window.__NOCTURNE__.metrics);
  assert.equal(report.initial.webgl2, true);
  assert.equal(report.initial.phase, 'battle');
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
    const delta = Math.floor((frame + 1) * 1000 / 30) - Math.floor(frame * 1000 / 30);
    await page.clock.runFor(delta);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 95,
      fromSurface: true, captureBeyondViewport: false });
    const bytes = Buffer.from(shot.data, 'base64');
    unique.add(createHash('sha256').update(bytes).digest('hex'));
    if (!encoder.stdin.write(bytes)) await once(encoder.stdin, 'drain');
    if ([0, 449, 899].includes(frame)) fs.writeFileSync(path.join(output, `frame-${frame}.jpg`), bytes);
    if (frame % 90 === 0) {
      const state = await page.evaluate(() => window.__NOCTURNE__.metrics);
      report.progress.push({ frame, time: state.time, phase: state.phase, kills: state.kills });
      console.log('FRAME', frame, JSON.stringify(report.progress.at(-1)));
      assert.notEqual(state.phase, 'defeat');
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
