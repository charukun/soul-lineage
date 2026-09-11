import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { graph, closure, appNode } from './workspaces.mjs';

const root = process.cwd();
const nodes = graph(root);
const selected = process.argv[2] ? new Set(process.argv.slice(2).flatMap(id => [...closure(nodes, nodes.has(id) ? id : appNode(nodes, id).name)])) : new Set(nodes.keys());
for (const name of selected) {
  const node = nodes.get(name);
  if (node.group === 'apps') {
    assert.ok(existsSync(resolve(root, node.dir, 'index.html')), `${name} requires its own index.html`);
    assert.ok(node.pkg.scripts?.build, `${name} requires an independent build`);
  }
  const files = readdirSync(resolve(root, node.dir), { recursive: true }).filter(p => /\.(m?js)$/.test(p) && !p.startsWith('node_modules/'));
  for (const file of files) {
    const absolute = resolve(root, node.dir, file);
    execFileSync(process.execPath, ['--check', absolute]);
    const source = readFileSync(absolute, 'utf8');
    if ((node.group === 'apps' && (file === 'src/app.js' || file.startsWith('src/game/'))) || ['@soul/platform', '@soul/network', '@soul/game-data', '@soul/world'].includes(name)) {
      assert.ok(!/\b(window|document|navigator|localStorage|sessionStorage)\s*[.\[]|\b(?:fetch|WebSocket|XMLHttpRequest)\s*\(/.test(source.replace(/\/\/[^\n]*/g, '')), `Platform-specific global in portable code: ${node.dir}/${file}`);
      assert.ok(!source.includes("from '@soul/platform-web'") && !source.includes("from '@soul/rendering'") && !source.includes("from '@soul/shared-ui'"), `Browser adapter imported by portable code: ${node.dir}/${file}`);
    }
    for (const match of source.matchAll(/(?:from\s*|import\s*\(?\s*|new URL\(\s*)['"]([^'"]+)['"]/g)) {
      const spec = match[1];
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
