import { readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { graph, closure, appNode } from './workspaces.mjs';
const nodes = graph();
const app = nodes.get(process.argv[2]) || appNode(nodes, process.argv[2]);
const files = [...closure(nodes, app.name)].flatMap(name => {
  const dir = `${nodes.get(name).dir}/tests`;
  return existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.test.mjs')).map(f => `${dir}/${f}`) : [];
});
if (files.length) execFileSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
else console.log(`No unit tests yet for ${app.id}; build and browser gates still apply.`);
