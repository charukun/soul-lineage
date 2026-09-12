import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
const links = [...head.matchAll(/<link\b[^>]*>/gi)].map(([tag]) =>
  Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(([, key, value]) => [key.toLowerCase(), value]))
).filter(link => link.rel?.split(/\s+/).includes('icon'));
const asset = href => readFileSync(new URL(`../public/${href.replace(/^\.\//, '').split('?')[0]}`, import.meta.url));

test('demon declares an explicit PNG favicon and scalable SVG in the HTML head', () => {
  assert.equal(links.length, 2, 'do not rely on the shared origin /favicon.ico');
  assert.ok(links.some(link => link.type === 'image/png' && link.sizes === '48x48'));
  assert.ok(links.some(link => link.type === 'image/svg+xml' && link.sizes === 'any'));
});

test('favicon links resolve inside the app for local, DEV and production subpaths', () => {
  assert.equal(links.length, 2);
  for (const link of links) {
    assert.match(link.href, /^\.\/icons\/[^/?]+(?:\?v=[\w.-]+)?$/);
    assert.ok(asset(link.href).length > 0, `${link.href} must be a real public asset`);
    for (const path of ['/', '/soul-lineage/dev/demon/', '/soul-lineage/demon/']) {
      const url = new URL(link.href, `https://example.invalid${path}`);
      assert.equal(url.origin, 'https://example.invalid');
      assert.ok(url.pathname.startsWith(`${path}icons/`), url.pathname);
    }
  }
});

test('mobile fallback is a complete decodable 48px RGBA PNG, not an empty placeholder', () => {
  const link = links.find(link => link.type === 'image/png');
  assert.ok(link, 'PNG favicon is required');
  const png = asset(link.href);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), 48);
  assert.equal(png.readUInt32BE(20), 48);
  assert.equal(png[24], 8);
  assert.equal(png[25], 6);
  assert.equal(png[28], 0, 'non-interlaced PNG');
  const data = [];
  let end = false;
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    assert.ok(offset + length + 12 <= png.length, 'PNG chunk must not be truncated');
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') data.push(png.subarray(offset + 8, offset + 8 + length));
    if (type === 'IEND') { end = true; assert.equal(length, 0); }
    offset += length + 12;
    if (end) assert.equal(offset, png.length, 'IEND must be the final chunk');
  }
  assert.ok(end);
  const pixels = inflateSync(Buffer.concat(data));
  assert.equal(pixels.length, 48 * (1 + 48 * 4));
  assert.ok(pixels.some(byte => byte > 4), 'PNG must not be a blank placeholder');
});

test('SVG favicon is self-contained and preserves the existing demon artwork', () => {
  const link = links.find(link => link.type === 'image/svg+xml');
  assert.ok(link, 'SVG favicon is required');
  const svg = asset(link.href).toString('utf8');
  assert.match(svg, /<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 512 512"/);
  assert.match(svg, /<path\b/);
  assert.doesNotMatch(svg, /<(?:script|image|foreignObject)\b|(?:href|src)\s*=/i);
});

test('favicon repair retains the current title and ominous title styling', () => {
  assert.match(head, /<title>尽喰廻遊 \| 人間狩りの夜<\/title>/);
  assert.match(head, /href="\.\/src\/web\/title-ominous\.css"/);
  assert.match(html, /<script type="module" src="\.\/src\/main\.js"><\/script>/);
});
