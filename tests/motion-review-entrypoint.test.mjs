import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workshopPath = new URL('../apps/rinne/characters.html', import.meta.url);
const legacyPath = new URL('../apps/rinne/public/simulator/motion-review.html', import.meta.url);
const entrypointPath = new URL('../apps/rinne/src/motion-review-entrypoint.js', import.meta.url);

test('character workshop is the single user-facing motion review entrypoint', async () => {
  const html = await readFile(workshopPath, 'utf8');

  assert.match(html, />演舞レビュー<\/button>/);
  assert.match(html, />▶ 30秒演舞<\/button>/);
  assert.match(html, /技単体も「確認する動き」から選択/);
  assert.match(html, /src="\.\/src\/motion-review-entrypoint\.js"/);
  assert.doesNotMatch(html, /href="\.\/simulator\/motion-review\.html"/);
});

test('legacy slash review URL deep-links to the canonical motion review tab', async () => {
  const html = await readFile(legacyPath, 'utf8');

  assert.match(html, /url=\.\.\/characters\.html\?review=motion/);
  assert.match(html, /location\.replace\('\.\.\/characters\.html\?review=motion'\)/);
  assert.doesNotMatch(html, /src="\.\/src\/motion-review\.js"/);
});

test('runtime entrypoint keeps canonical labels after Motion QA UI setup', {timeout:240000}, async () => {
  const source = await readFile(entrypointPath, 'utf8');

  assert.match(source, /tab: '演舞'/);
  assert.match(source, /heading: '演舞レビュー'/);
  assert.match(source, /start: '▶ 30秒演舞'/);
  assert.match(source, /searchParams\.get\('review'\) === REVIEW_QUERY/);

  const {chromium}=await import('@playwright/test');
  const {spawn,execFileSync}=await import('node:child_process');
  const {resolve}=await import('node:path');
  const root=resolve(new URL('..',import.meta.url).pathname);
  execFileSync(process.execPath,['scripts/prepare-kaykit-foundation.mjs','character-studio'],{cwd:root,stdio:'inherit'});
  const vite=resolve(root,'node_modules/vite/bin/vite.js');
  const start=(cwd,port)=>spawn(process.execPath,[vite,'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd,stdio:'ignore',env:{...process.env,APP_ENV:'dev'}});
  const char=start(resolve(root,'apps/character-studio'),5277),rinne=start(resolve(root,'apps/rinne'),5278);
  const wait=async url=>{for(let i=0;i<80;i++){try{if((await fetch(url)).ok)return}catch{}await new Promise(r=>setTimeout(r,250))}throw Error('preview timeout '+url)};
  let browser;
  try{
    await Promise.all([wait('http://127.0.0.1:5277/'),wait('http://127.0.0.1:5278/review-motion')]);
    const chrome=execFileSync('bash',['-lc','command -v google-chrome || command -v google-chrome-stable || command -v chromium'],{encoding:'utf8'}).trim();
    browser=await chromium.launch({executablePath:chrome,headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--no-sandbox']});
    const verify=async({url,ready,canvas})=>{
      const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(ready,null,{timeout:120000});
      const evidence=[];
      for(const [width,height] of [[390,844],[844,390],[390,844]]){
        await page.setViewportSize({width,height});await page.waitForTimeout(180);
        const row=await page.evaluate(selector=>{const c=document.querySelector(selector),r=c.getBoundingClientRect(),gl=c.getContext('webgl2')||c.getContext('webgl'),back=document.querySelector('.review-surface__back[data-review-back]');return{viewport:[innerWidth,innerHeight],rect:[r.x,r.y,r.width,r.height],buffer:gl?[gl.drawingBufferWidth,gl.drawingBufferHeight]:null,back:back?.textContent||''}},canvas);
        assert.ok(row.rect[2]>1&&row.rect[3]>1,JSON.stringify(row));assert.ok(row.buffer?.[0]>1&&row.buffer?.[1]>1,JSON.stringify(row));assert.equal(row.back,'‹ 戻る');evidence.push(row);
      }
      await context.close();return evidence;
    };
    const character=await verify({url:'http://127.0.0.1:5277/',ready:()=>window.characterStudio?.review?.ready===true&&document.body.classList.contains('character-grid-ready'),canvas:'#stage'});
    const motion=await verify({url:'http://127.0.0.1:5278/review-motion',ready:()=>Number(document.querySelector('#motion-load')?.value)===1,canvas:'#motion-stage'});
    console.log('REVIEW_RESIZE_EVIDENCE',JSON.stringify({character,motion}));
  }finally{
    await browser?.close().catch(()=>{});
    for(const p of [char,rinne])if(p.exitCode===null)p.kill('SIGTERM');
  }
});
