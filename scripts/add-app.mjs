import { existsSync, readdirSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { graph, apps } from './workspaces.mjs';
const [id, title = id] = process.argv.slice(2);
if (!/^[a-z][a-z0-9-]*$/.test(id || '') || !title || /[<>"'&\r\n]/.test(title)) throw new Error('Usage: npm run app:add -- app-id "Game title" (plain text)');
const destination = resolve('apps', id);
if (existsSync(destination)) throw new Error(`App already exists: ${id}`);
const usedPorts = new Set(apps(graph()).flatMap(n => Object.values(n.pkg.scripts).flatMap(s => [...s.matchAll(/--port (\d+)/g)].map(m => Number(m[1])))));
let port = 5173; while (usedPorts.has(port) || usedPorts.has(port + 100)) port++;
for (const file of readdirSync('templates/app', { recursive: true, withFileTypes: true }).filter(e => e.isFile())) {
  const source = resolve(file.parentPath, file.name);
  const relative = source.slice(resolve('templates/app').length + 1);
  const target = resolve(destination, relative); mkdirSync(dirname(target), { recursive: true });
  const text = readFileSync(source, 'utf8').replaceAll('__APP_ID__', id).replaceAll('__APP_TITLE__', title).replaceAll('__DEV_PORT__', String(port)).replaceAll('__PREVIEW_PORT__', String(port + 100));
  writeFileSync(target, text);
}
console.log(`Created apps/${id}. Run npm install --package-lock-only, npm ci, then npm run build --workspace @soul/${id}. CI/CD discovers the workspace automatically.`);
