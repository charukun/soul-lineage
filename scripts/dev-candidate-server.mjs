import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const MIME = new Map([
  ['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.mjs','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],
  ['.json','application/json; charset=utf-8'],['.svg','image/svg+xml'],['.png','image/png'],['.jpg','image/jpeg'],['.jpeg','image/jpeg'],['.webp','image/webp'],
  ['.glb','model/gltf-binary'],['.gltf','model/gltf+json'],['.wasm','application/wasm'],['.mp3','audio/mpeg'],['.ogg','audio/ogg'],['.wav','audio/wav'],
]);

export function candidatePath(root, requestPath, mount = '/soul-lineage/') {
  let pathname = decodeURIComponent(String(requestPath || '/').split('?')[0]);
  if (pathname.startsWith(mount)) pathname = `/${pathname.slice(mount.length)}`;
  pathname = pathname.replace(/^\/+/, '');
  const target = resolve(root, pathname || 'index.html');
  const prefix = resolve(root) + sep;
  if (target !== resolve(root) && !target.startsWith(prefix)) throw new Error('CANDIDATE_PATH_ESCAPE');
  return target;
}

export function createCandidateServer(root, { mount = '/soul-lineage/' } = {}) {
  const absolute = resolve(root);
  return createServer(async (request, response) => {
    try {
      let target = candidatePath(absolute, request.url, mount);
      let info = await stat(target).catch(() => null);
      if (info?.isDirectory()) { target = resolve(target, 'index.html'); info = await stat(target).catch(() => null); }
      if (!info?.isFile()) { response.writeHead(404, {'content-type':'text/plain; charset=utf-8'}); response.end('Not found'); return; }
      response.writeHead(200, {
        'content-type': MIME.get(extname(target).toLowerCase()) || 'application/octet-stream',
        'cache-control': 'no-store',
        'x-rinne-dev-candidate': 'true',
      });
      if (request.method === 'HEAD') { response.end(); return; }
      createReadStream(target).pipe(response);
    } catch (error) {
      response.writeHead(400, {'content-type':'text/plain; charset=utf-8'}); response.end(error.message);
    }
  });
}

async function main() {
  const root = process.argv[2] || '_site';
  const port = Number(process.env.CANDIDATE_PORT || 4173);
  const server = createCandidateServer(root);
  await new Promise((resolveListen, reject) => server.once('error', reject).listen(port, '127.0.0.1', resolveListen));
  console.log(`DEV candidate listening on http://127.0.0.1:${port}/soul-lineage/`);
  const close = () => server.close(() => process.exit(0));
  process.once('SIGTERM', close); process.once('SIGINT', close);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
