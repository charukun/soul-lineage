import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'node_modules/three/examples/jsm/libs/basis');
if (!existsSync(source)) throw new Error(`Three.js Basis transcoder not found: ${source}`);
const requested = process.argv.slice(2);
const apps = requested.length ? requested : ['rinne', 'village', 'demon'];
const allowed = new Set(['rinne', 'village', 'demon']);
const files = readdirSync(source).filter(name => /basis_transcoder\.(js|wasm)$/.test(name));
if (!files.some(name => name.endsWith('.wasm')) || !files.some(name => name.endsWith('.js'))) throw new Error('Incomplete Basis transcoder package');
for (const app of apps) {
  if (!allowed.has(app)) throw new Error(`Unknown app: ${app}`);
  const target = resolve(root, `apps/${app}/public/basis`);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const file of files) cpSync(resolve(source, file), resolve(target, file));
  console.log(`[basis] ${app}: ${files.join(', ')}`);
}
