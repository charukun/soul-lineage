import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { graph, closure, appNode } from './workspaces.mjs';
import { importSpecifiers } from './import-specifiers.mjs';

const root = process.cwd();
const nodes = graph(root);
const nativeBrowserDialog = /\b(?:(?:window|globalThis|self)\s*\.\s*)?(?:alert|confirm|prompt)\s*\(/;
const nativeEntryChoice = /<select\b|<input\b[^>]*\btype\s*=\s*["']?checkbox\b/i;
const selected = process.argv[2] ? new Set(process.argv.slice(2).flatMap(id => [...closure(nodes, nodes.has(id) ? id : appNode(nodes, id).name)])) : new Set(nodes.keys());
for (const name of selected) {
  const node = nodes.get(name);
  if (node.group === 'apps') {
    const entryPath=resolve(root,node.dir,'index.html');
    assert.ok(existsSync(entryPath), `${name} requires its own index.html`);
    assert.ok(node.pkg.scripts?.build, `${name} requires an independent build`);
    const entrySource=readFileSync(entryPath,'utf8').replace(/<!--[\s\S]*?-->/g,'');
    assert.ok(!nativeBrowserDialog.test(entrySource), `Native browser alert/confirm/prompt is forbidden in consumer entry HTML: ${node.dir}/index.html.`);
    assert.ok(!nativeEntryChoice.test(entrySource), `Visible native select/checkbox is forbidden in consumer entry HTML: ${node.dir}/index.html. Use an app-owned choice surface.`);
  }
  const files = readdirSync(resolve(root, node.dir), { recursive: true }).filter(p => /\.(m?js)$/.test(p) && !p.startsWith('node_modules/'));
  for (const file of files) {
    const absolute = resolve(root, node.dir, file);
    execFileSync(process.execPath, ['--check', absolute]);
    const source = readFileSync(absolute, 'utf8');
    const sourceWithoutLineComments = source.replace(/\/\/[^\n]*/g, '');
    if (node.group === 'apps' && file.startsWith('src/')) {
      assert.ok(!nativeBrowserDialog.test(sourceWithoutLineComments), `Native browser alert/confirm/prompt is forbidden in app source: ${node.dir}/${file}. Use an app-owned dialog or notification surface.`);
    }
    if ((node.group === 'apps' && (file === 'src/app.js' || file.startsWith('src/game/'))) || ['@soul/platform', '@soul/network', '@soul/game-data', '@soul/world'].includes(name)) {
      assert.ok(!/\b(window|document|navigator|localStorage|sessionStorage)\s*[.\[]|\b(?:fetch|WebSocket|XMLHttpRequest)\s*\(/.test(sourceWithoutLineComments), `Platform-specific global in portable code: ${node.dir}/${file}`);
      assert.ok(!source.includes("from '@soul/platform-web'") && !source.includes("from '@soul/rendering'") && !source.includes("from '@soul/shared-ui'"), `Browser adapter imported by portable code: ${node.dir}/${file}`);
    }
    for (const spec of importSpecifiers(source)) {
      if (file === 'vite.config.js' && spec === '../../scripts/vite-app.mjs') continue;
      if (spec.startsWith('.')) {
        const target = relative(root, resolve(absolute, '..', spec));
        assert.ok(target.startsWith(`${node.dir}/`), `Cross-workspace relative import: ${node.dir}/${file} -> ${spec}`);
      } else if (!spec.startsWith('node:')) {
        const dependency = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        assert.ok(node.dependencies.includes(dependency), `Undeclared dependency ${dependency} in ${node.dir}/${file}`);
      }
    }
  }
}
for (const file of readdirSync('scripts').filter(p => p.endsWith('.mjs'))) execFileSync(process.execPath, ['--check', `scripts/${file}`]);
console.log(`Workspace boundaries and syntax verified: ${[...selected].join(', ')}`);
