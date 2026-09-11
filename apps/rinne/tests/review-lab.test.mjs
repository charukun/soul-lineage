import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('apps/rinne/review.html', 'utf8');
const source = readFileSync('apps/rinne/src/review/main.js', 'utf8');
const adapter = readFileSync('apps/rinne/src/review/review-adapter.js', 'utf8');
const vite = readFileSync('apps/rinne/vite.config.js', 'utf8');
const rendering = readFileSync('packages/rendering/src/index.js', 'utf8');
const devcontainer = readFileSync('.devcontainer/devcontainer.json', 'utf8');
const rootPackage = JSON.parse(readFileSync('package.json', 'utf8'));
const previewBuild = readFileSync('scripts/build-review.mjs', 'utf8');

assert.match(html, /id="review-canvas"/);
assert.match(html, /レビュー情報をコピー/);
assert.match(source, /GLTFLoader/);
assert.match(source, /OrbitControls/);
assert.match(source, /1\s*\/\s*60/);
assert.match(source, /SkeletonHelper/);
assert.match(source, /review-adapter\.js/);
assert.match(adapter, /installReviewExtensions/);
assert.match(vite, /review\.html/);
assert.doesNotMatch(vite, /REVIEW_LAB|CODESPACE_NAME|review-lab-entry/);
assert.match(rendering, /GLTFLoader/);
assert.match(rendering, /OrbitControls/);
assert.doesNotMatch(devcontainer, /postStartCommand|openBrowser|REVIEW_LAB=1/);
assert.equal(rootPackage.scripts['build:review'], 'node scripts/build-review.mjs');
assert.match(previewBuild, /build:rinne/);
assert.match(previewBuild, /copyFileSync\(review, appIndex\)/);
