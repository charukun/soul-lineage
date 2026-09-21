import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('Visual Review and Character Studio are independent DEV apps with one canonical Worker each',async()=>{
  const [reviewPkg,studioPkg,reviewConfig,reviewWrangler,studioWrangler,applications,bridge]=await Promise.all([
    read('apps/review/package.json'),
    read('apps/character-studio/package.json'),
    read('apps/review/src/review-lab-config.js'),
    read('wrangler.dev.review.jsonc'),
    read('wrangler.dev.character-studio.jsonc'),
    read('ops-board/applications.mjs'),
    read('apps/rinne/review.html'),
  ]);
  assert.equal(JSON.parse(reviewPkg).appKind,'dev-tool');
  assert.equal(JSON.parse(studioPkg).appKind,'dev-tool');
  assert.match(reviewWrangler,/soul-lineage-review-dev/);
  assert.match(studioWrangler,/soul-lineage-character-studio-dev/);
  assert.match(reviewConfig,/charactersBase:REVIEW_DEV\.characters/);
  assert.match(reviewConfig,/soul-lineage-character-studio-dev\.c-okamoto\.workers\.dev/);
  const catalog=await read('scripts/application-catalog.mjs');
  assert.match(catalog,/id:'character-studio', deployApp:'character-studio'/);
  assert.match(catalog,/id:'visual-review', deployApp:'review'/);
  assert.match(applications,/PULSE_SURFACES/);
  assert.match(applications,/fastDevTarget\(surface\.deployApp/);
  assert.doesNotMatch(applications,/rinneDevToolTarget|dev\/rinne\/review\.html|dev\/rinne\/characters\.html/);
  assert.match(bridge,/data-review-bridge/);
  assert.match(bridge,/soul-lineage-review-dev\.c-okamoto\.workers\.dev/);
  assert.doesNotMatch(bridge,/data-review-target=/);
});

test('RINNE specialist review routes are canonical and declared once',async()=>{
  const [vite,manifest,reviewConfig,rinneShell]=await Promise.all([
    read('apps/rinne/vite.config.js'),
    read('packages/shared-ui/src/review/manifest.js'),
    read('apps/review/src/review-lab-config.js'),
    read('apps/rinne/src/review-lab-shell.js'),
  ]);
  for(const entry of ['reviewMotion','reviewAssets','reviewObjects','reviewEffects','reviewSound','reviewBattle']){
    assert.match(vite,new RegExp(entry+':fileURLToPath'));
  }
  assert.doesNotMatch(vite,/characters(?:Advanced)?:fileURLToPath/);
  for(const [id,path] of Object.entries({motion:'review-motion',equipment:'review-assets',objects:'review-objects',effects:'review-effects',sounds:'review-sound',battle:'review-battle'})){
    assert.match(manifest,new RegExp(`${id}:'${path}'`));
  }
  assert.doesNotMatch(manifest,/review-(?:motion|assets|objects|effects|sound|battle)\.html/);
  assert.match(reviewConfig,/\.\.\.createReviewRoutes\(/);
  assert.doesNotMatch(reviewConfig,/motion:\s*reviewRoute|equipment:\s*reviewRoute|objects:\s*reviewRoute|effects:\s*reviewRoute|sounds:\s*reviewRoute|battle:\s*reviewRoute/);
  assert.match(rinneShell,/motion:\['\.motion-camera-strip'\]/);
  assert.match(rinneShell,/equipment:\['\.asset-camera-strip'\]/);
  assert.match(rinneShell,/mountReviewStageControls\(\{groups,label:'表示・再生コントロール'\}\)/);
});

test('shared review shell keeps manifest, shell, stage, and control styles separated behind one facade',async()=>{
  const [shell,stage,manifest,controls]=await Promise.all([
    read('packages/shared-ui/src/review/shell.js'),
    read('packages/shared-ui/src/review/stage.js'),
    read('packages/shared-ui/src/review/manifest.js'),
    read('packages/shared-ui/src/review/controls.css'),
  ]);
  assert.match(shell,/from '\.\/manifest\.js'/);
  assert.match(shell,/from '\.\/stage\.js'/);
  assert.match(shell,/import '\.\/controls\.css'/);
  assert.doesNotMatch(shell,/const FILES=|function createReviewStageLifecycle|function mountReviewStageControls/);
  assert.match(stage,/export function mountReviewStageControls/);
  assert.match(stage,/export function createReviewStageLifecycle/);
  assert.match(manifest,/export const REVIEW_PROBES/);
  assert.match(controls,/\.review-stage-controls/);
});

test('GitHub Pages is not reintroduced as a DEV tool route',async()=>{
  const [applications,distribution]=await Promise.all([read('ops-board/applications.mjs'),read('docs/DISTRIBUTION_ARCHITECTURE.md')]);
  const toolSection=applications.slice(applications.indexOf("groups.set('character-studio'"),applications.indexOf('for (const env'));
  assert.doesNotMatch(toolSection,/charukun\.github\.io|PAGES_ROOT|rinneDevToolTarget/);
  assert.match(distribution,/GitHub Pages is not a DEV publisher/);
});


test('Visual Review Lab entrypoint stays orchestration-only after the split',async()=>{
  const [main,config,icons,warmup]=await Promise.all([
    read('apps/review/src/main.js'),
    read('apps/review/src/review-lab-config.js'),
    read('apps/review/src/review-lab-icons.js'),
    read('apps/review/src/review-lab-warmup.js'),
  ]);
  assert.match(main,/review-lab-config\.js/);
  assert.match(main,/review-lab-icons\.js/);
  assert.match(main,/review-lab-warmup\.js/);
  assert.doesNotMatch(main,/MENU_ICONS|const warmed=|function warmRoute/);
  assert.doesNotMatch(config,/reviewRoute\s*=/);
  assert.match(icons,/export const REVIEW_MENU_ICONS/);
  assert.match(warmup,/export function createReviewWarmup/);
});
