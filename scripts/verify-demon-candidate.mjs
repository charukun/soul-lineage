// The same browser assertions run against a PR build and its public deployment.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve('dist');
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let file = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const type = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.json':'application/json', '.txt':'text/plain' }[extname(file)];
    res.setHeader('Content-Type', type || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const version = JSON.parse(readFileSync('dist/demon/version.json', 'utf8'));
const child = spawn('npm', ['exec', '--', 'playwright', 'test', '--config', 'scripts/browser/config.mjs'], {
  stdio: 'inherit', env: { ...process.env, BROWSER_SITE_URL: `http://127.0.0.1:${server.address().port}/`,
    BROWSER_TARGETS: JSON.stringify([{ app:'demon', path:'demon', legacy:false, version }]) },
});
child.on('error', error => { console.error(error); server.close(); process.exitCode = 1; });
child.on('exit', code => { server.close(); process.exitCode = code ?? 1; });
