import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const exportedPickers = [
  'mountReviewSelect',
  'mountReviewGroup',
  'mountReviewSelectGrid',
  'mountReviewGroupDeck',
];

// Exercise Vite's real JS/CSS resolver, including the compatibility entry.
// Syntax-only checks cannot detect a missing side-effect stylesheet import.
for (const entry of ['src/review/slot-picker.js', 'src/review-slot-picker.js']) {
  test(`${entry} bundles its stylesheet and preserves the picker API`, async () => {
    const result = await build({
      root,
      configFile: false,
      publicDir: false,
      logLevel: 'error',
      build: {
        write: false,
        minify: false,
        cssMinify: false,
        reportCompressedSize: false,
        lib: {
          entry: fileURLToPath(new URL(`../${entry}`, import.meta.url)),
          formats: ['es'],
          fileName: 'review-slot-picker',
        },
      },
    });
    const output = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
    const chunk = output.find(item => item.type === 'chunk' && item.isEntry);
    assert.ok(chunk, 'the picker must produce an entry bundle');
    for (const name of exportedPickers) assert.ok(chunk.exports.includes(name), `${name} must remain exported`);
    const stylesheets = output.filter(item => item.type === 'asset' && item.fileName.endsWith('.css'));
    assert.ok(stylesheets.length > 0, 'the bundle must include the real picker stylesheet');
    assert.ok(stylesheets.some(item => item.source.length > 0), 'the emitted stylesheet must not be empty');
  });
}
