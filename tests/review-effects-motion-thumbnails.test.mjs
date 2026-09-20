import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('runtime thumbnails scale inside five-column review cards',async()=>{
  const shared=await read('packages/shared-ui/src/review-shell.css');
  assert.match(shared,/\.review-runtime-thumbnail\{[^}]*width:100%!important[^}]*aspect-ratio:36\/23!important/);
  assert.match(shared,/\.review-choice-grid\{[^}]*repeat\(5,minmax\(0,1fr\)\)!important/);
});
test('effect review exposes high-resolution visible thumbnails in five columns',async()=>{
  const [js,css]=await Promise.all([read('apps/rinne/src/review-effects.js'),read('apps/rinne/src/review-effects.css')]);
  assert.match(js,/antialias:true,preserveDrawingBuffer:true/);assert.match(js,/setSize\(288,184,false\)/);assert.match(js,/PerspectiveCamera\(40,288\/184/);
  assert.match(css,/\.fx-catalog\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);assert.match(css,/\.fx-option\{min-height:108px!important/);
  assert.match(css,/@media\(max-width:640px\)[\s\S]*?\.fx-option\{min-height:96px!important/);
});
test('motion review remains image-first with accessible names and reserved thumbnail geometry',async()=>{
  const [js,css,runtime]=await Promise.all([read('apps/rinne/src/review-motion.js'),read('apps/rinne/src/review-motion.css'),read('apps/rinne/src/review-runtime-thumbnail.js')]);
  assert.match(css,/\.motion-grid \.review-choice-card\{min-height:0!important;display:block!important;aspect-ratio:36\/23!important/);
  assert.match(css,/\.motion-grid \.review-choice-card>\.review-runtime-thumbnail\{width:100%!important;height:100%!important;aspect-ratio:36\/23!important;min-height:0!important/);
  assert.match(css,/@media\(max-width:620px\)[\s\S]*?\.motion-grid \.review-choice-card\{min-height:0!important/);
  assert.match(js,/button\.setAttribute\('aria-label',label\);button\.title=label;button\.append\(thumbnail\);/);
  assert.doesNotMatch(js,/motion-category/);assert.match(runtime,/paintPlaceholder\(canvas\)/);
  assert.match(runtime,/requestIdleCallback\?requestIdleCallback\(callback,\{timeout:90\}\)/);
});
test('lower mobile controls stay in flow and secondary models remain collapsible',async()=>{
  const [css,html]=await Promise.all([read('apps/rinne/src/review-motion.css'),read('apps/rinne/review-motion.html')]);
  assert.match(css,/@media\(max-width:620px\)[\s\S]*?\.motion-playback\{order:2;position:static!important/);
  assert.match(html,/<details class="motion-models">/);
  assert.match(html,/<summary><span class="control-label">表示モデル<\/span><strong>素体を変更<\/strong><\/summary>/);
});
test('motion review uses the shared adapter and an eligible rigged default',async()=>{
  const source=await read('apps/rinne/src/review-motion.js');
  assert.match(source,/const REVIEW_MODELS=KAYKIT_MODELS;/);assert.match(source,/let selectedModel=REVIEW_MODELS\[0\]/);
  assert.doesNotMatch(source,/mesh2motion-review-mannequin|kaykitHumanoidFromGLTF/);
  assert.match(source,/targetAdapter=createHumanoidPreview\(gltf.scene/);
  assert.match(source,/loadPinnedReviewTarget\(model\)/);
  assert.doesNotMatch(source,/埋め込みモーションがありません|baselineClips:.*Idle/);
});
// User-approved policy change: preserve the chosen clip and tolerate partial rigs.
// The previous auto-switch assertion would now require the wrong motion to be played.
// Deformation, missing-bone and integrity behavior are covered by native wrapper/source tests.
test('preview never silently substitutes a clip or disables an approximate binding',async()=>{
  const source=await read('apps/rinne/src/review-motion.js');
  assert.doesNotMatch(source,/nextPlayableMotion|selectMotion\(fallback\)|invalidMotionIds/);
  assert.match(source,/mode:'preview'/);assert.match(source,/同じ候補を押して再試行/);
  assert.match(source,/serial!==selectSerial\|\|modelSerial!==loadSerial\|\|stopped/);
  assert.match(source,/const serial=\+\+loadSerial; \+\+selectSerial/);
  assert.match(source,/canvas.dataset.motionCompatibility=code/);
  assert.doesNotMatch(source,/\n\s*resize\(\)/);
  assert.match(source,/if\(ready&&playing\)/);
});
