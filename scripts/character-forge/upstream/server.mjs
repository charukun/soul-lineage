// Local artifact host for the pinned factory. No model generation occurs here.
import {createServer} from 'node:http';
import {readFileSync, existsSync, realpathSync, statSync} from 'node:fs';
import {resolve, dirname, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const media = {'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.glb':'model/gltf-binary','.html':'text/html'};
function safe(root, suffix) {
  const base = realpathSync(root), path = resolve(base, suffix);
  if(path !== base && !path.startsWith(base+sep)) throw new Error('Path escapes artifact root');
  if(!existsSync(path)||!statSync(path).isFile()) throw new Error('Artifact is missing');
  const real=realpathSync(path);if(!real.startsWith(base+sep))throw new Error('Symlink escapes artifact root');
  return real;
}
export async function startArtifactHost({workspace, factory, port=0}) {
  workspace=realpathSync(workspace);const factoryPath=safe(workspace,factory);
  const compiled=stripTypeScriptTypes(readFileSync(factoryPath,'utf8'),{mode:'strip',sourceUrl:factoryPath});
  const index=`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#e7e9e9}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/":"/three/"}}</script></head><body><script type="module" src="/host/runtime.mjs"></script></body></html>`;
  const server=createServer((req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');let bytes,type;
      if(url.pathname==='/'){bytes=index;type='text/html';}
      else if(url.pathname==='/factory.js'){bytes=compiled;type='text/javascript';}
      else {
        const routes=[['/host/',here],['/three/',resolve(repo,'node_modules/three')],['/artifact/',workspace]];
        const route=routes.find(([prefix])=>url.pathname.startsWith(prefix));
        if(!route)throw new Error('Unknown path');
        const path=safe(route[1],decodeURIComponent(url.pathname.slice(route[0].length)));
        bytes=readFileSync(path);type=media[extname(path)]||'application/octet-stream';
      }
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);
    }catch(error){res.writeHead(404,{'Content-Type':'text/plain'});res.end(String(error.message));}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {url:`http://127.0.0.1:${server.address().port}/`,close:()=>new Promise(r=>server.close(r))};
}
