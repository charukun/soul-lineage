import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {readFile,writeFile,mkdir,copyFile,rm,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

const input=JSON.parse(await readFile('.storybook-task-input.json','utf8'));
const out='.storybook-evidence';await mkdir(out,{recursive:true});
const pages=['heart','technique','body','items'];
const head=process.env.GITHUB_SHA,repo=process.env.GITHUB_REPOSITORY,branch='feat/rinne-approved-storybook-20260922';
const calibration='apps/rinne/src/storybook-calibration.css';
const originalCss=await readFile(calibration,'utf8');
const harness='apps/rinne/storybook-review.html';
const index=await readFile('apps/rinne/index.html','utf8');
const htmlHead=index.match(/<head>[\s\S]*?<\/head>/)[0];
const game=index.match(/<section id="game-screen"[\s\S]*?<\/section>/)[0].replace('is-loading','').replace('aria-busy="true"','aria-busy="false"');
await writeFile(harness,`<!doctype html><html lang="ja">${htmlHead}<body><main id="app" data-screen="game">${game}</main><script type="module">
import {createGameplayUI} from './src/inspiration-gameplay-ui.js';
import {createLife} from './src/rebuild/domain.js';
import {ensureCombatLoadout,setHeartSlot} from './src/combat-loadout.js';
import {SUPPORT_SKILLS,ACTION_SKILLS} from './src/rebuild/skill-system.js';
import {ensureInspiration} from './src/rebuild/inspiration-state.js';
const screen=document.querySelector('#game-screen');screen.dataset.gameplayUpgrade='true';screen.style.cssText='position:fixed;inset:0;width:100vw;height:100dvh;display:block';document.querySelector('#loading-card').remove();
const audio={ui(){},item(){},combat(){},unlock(){}};
let state;
function fixture(age=20){const s=createLife({seed:491});s.name='旅人';s.phase='living';s.ageYears=age;s.ageSeconds=age*60;ensureInspiration(s);s.inspiration.legacySkills=[...SUPPORT_SKILLS.slice(0,12).map(v=>v.id),...ACTION_SKILLS.filter(v=>!v.id.startsWith('spark.')).slice(0,9).map(v=>v.id)];s.knownSkills=[...new Set([...s.knownSkills,...s.inspiration.legacySkills])];s.equipment={weapon:age>=7?'sword':'fist',armor:'cloth',shield:false};s.inventory={weapons:age>=7?['fist','sword','dagger','great','spear','axe','staff']:['fist'],armors:age>=7?['cloth','light','heavy']:['cloth'],shields:age>=7?[false,true]:[false]};ensureCombatLoadout(s);for(let i=0;i<3;i++)setHeartSlot(s,i,SUPPORT_SKILLS[i].id);return s;}
const ui=createGameplayUI(screen,{stations:[],layout:{id:'fixture',objects:[]},audio,requestEquip(kind,value){if(state.ageYears<7)return {ok:false,reason:'武具は7歳からです。'};if(state.combat)return {ok:false,reason:'戦闘中です。'};const changed=state.equipment[kind]!==value;state.equipment[kind]=value;return {ok:true,changed};}});
window.bookReview={ui,fixture,get state(){return state},set(next){state=next;ui.bindState(next)},snapshot(){return structuredClone(state.combatLoadout)}};
window.bookReview.set(fixture());window.bookReady=true;
</script></body></html>`);
const server=await createServer({configFile:'apps/rinne/vite.config.js',server:{host:'127.0.0.1',port:4173,strictPort:true}});await server.listen();
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:941,height:1672},deviceScaleFactor:1,reducedMotion:'reduce'});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
const params=Object.fromEntries(pages.map(p=>[p,{top:15,bottom:13,heading:12,loadout:25,library:49}]));
const cssFor=()=>pages.map(p=>`.rb-page[data-book-page="${p}"]{--rb-top:${params[p].top}%;--rb-bottom:${params[p].bottom}%;--rb-heading:${params[p].heading}%;--rb-loadout:${params[p].loadout}%;--rb-library-width:${params[p].library}%}`).join('\n')+'\n';
const target={heart:{bookTop:.153,headBottom:.239,currentBottom:.414,detailX:.518,bookBottom:.865},technique:{bookTop:.153,headBottom:.238,currentBottom:.398,detailX:.516,bookBottom:.870},body:{bookTop:.153,headBottom:.235,currentBottom:.420,detailX:.565,bookBottom:.862},items:{bookTop:.153,headBottom:.237,currentBottom:.426,detailX:.542,bookBottom:.873}};
async function settle(){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.rb-page img')].map(im=>im.complete?Promise.resolve():new Promise(r=>{im.onload=im.onerror=r})));});await page.waitForTimeout(120);}
async function select(p){await page.evaluate(p=>window.bookReview.ui.open(p),p);await settle();}
async function geometry(){return page.evaluate(()=>{const r=s=>{const v=document.querySelector(s)?.getBoundingClientRect();return v?{x:v.x,y:v.y,w:v.width,h:v.height,right:v.right,bottom:v.bottom}:null};const missing=[...document.querySelectorAll('.rb-page img')].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src);return {book:r('.rb-book'),head:r('.rb-book-head'),current:r('.rb-current'),detail:r('.rb-detail'),nav:r('.rinne-primary-four'),page:r('.rb-page'),missing,view:{w:innerWidth,h:innerHeight}};});}
function layoutLoss(p,g){const t=target[p],v=[g.book.y/g.view.h-t.bookTop,g.head.bottom/g.view.h-t.headBottom,g.current.bottom/g.view.h-t.currentBottom,g.detail.x/g.view.w-t.detailX,g.book.bottom/g.view.h-t.bookBottom];return v.reduce((s,x)=>s+Math.abs(x),0)/v.length;}
const hash=b=>createHash('sha256').update(b).digest('hex');
function imageLoss(p,path){return Number(execFileSync('python3',['scripts/rinne-storybook-pixels.py',`docs/rinne/ui-reference-v6/${p}.png`,path],{encoding:'utf8'}).trim());}
async function capture(p,path){const buffer=await page.screenshot({path,fullPage:false,type:path.endsWith('.jpg')?'jpeg':'png',...(path.endsWith('.jpg')?{quality:82}:{})});const g=await geometry();assert.equal(g.missing.length,0,`Missing production artwork: ${g.missing}`);assert.ok(g.book.w>g.view.w*.8,'book width');assert.ok(g.nav.bottom<=g.view.h+1,'core controls inside viewport');const pixel=imageLoss(p,path),layout=layoutLoss(p,g);return {sha256:hash(buffer),pixel,layout,score:pixel*.55+layout*.45,geometry:g};}
const rounds=[];let functional=[];
try{
  await page.goto('http://127.0.0.1:4173/storybook-review.html');await page.waitForFunction(()=>window.bookReady,{timeout:60000});
  for(const p of pages){await select(p);await capture(p,`${out}/initial-${p}.png`);}
  if(Number(input.rounds)>0){
    assert.equal(Number(input.rounds),100,'The requested authoring loop is exactly 100 rounds');
    await writeFile(calibration,cssFor());await page.waitForTimeout(200);
    for(const p of pages){
      await select(p);
      for(let local=0;local<25;local++){
        const index=rounds.length+1,field=['top','bottom','heading','loadout','library'][local%5],prior=params[p][field],step=[1,.6,.35,.2,.1][Math.floor(local/5)],direction=Math.floor(local/5)%2?-1:1;
        const beforePath=`${out}/${String(index).padStart(3,'0')}-${p}-before.jpg`,afterPath=`${out}/${String(index).padStart(3,'0')}-${p}-after.jpg`;
        const before=await capture(p,beforePath);
        params[p][field]=Math.round((prior+step*direction)*1000)/1000;
        const candidateCss=cssFor();await writeFile(calibration,candidateCss);await page.waitForTimeout(180);await settle();
        const after=await capture(p,afterPath),accepted=after.score<before.score;
        if(!accepted){params[p][field]=prior;await writeFile(calibration,cssFor());await page.waitForTimeout(150);await settle();}
        const verified=await geometry();assert.equal(verified.missing.length,0);assert.ok(verified.nav.bottom<=verified.view.h+1);
        rounds.push({index,page:p,exactHead:head,parameter:field,beforeValue:prior,candidateValue:prior+step*direction,accepted,before,after,sourceCssSha256:hash(candidateCss),screenshots:{before:beforePath.split('/').pop(),after:afterPath.split('/').pop()}});
        console.log(`round ${index}/100 ${p} ${field}: ${before.score.toFixed(5)} -> ${after.score.toFixed(5)} ${accepted?'retained':'reverted'}`);
      }
    }
  }
  for(const p of pages){await select(p);await capture(p,`${out}/final-${p}.png`);}
  // Separate functional probe context; reference measurements never inject application behavior.
  const probeContext=await browser.newContext({viewport:{width:390,height:680},deviceScaleFactor:1,reducedMotion:'reduce'}),probe=await probeContext.newPage();
  await probe.goto('http://127.0.0.1:4173/storybook-review.html');await probe.waitForFunction(()=>window.bookReady,{timeout:60000});
  await probe.locator('[data-heart]').click();await probe.locator('.rb-page[data-book-page="heart"]').waitFor();
  assert.equal(await probe.locator('.rinne-primary-four button').count(),4);
  const before=await probe.evaluate(()=>window.bookReview.snapshot());
  const candidate=probe.locator('.rb-tile').nth(4);const id=await candidate.getAttribute('data-book-id');await candidate.click();
  assert.deepEqual(await probe.evaluate(()=>window.bookReview.snapshot()),before,'Preview does not equip');
  await probe.locator('[data-book-action="equip"]').click();assert.equal(await probe.evaluate(()=>window.bookReview.state.combatLoadout.heart.active[0]),id);functional.push('heart-preview-and-confirm');
  for(const p of ['technique','body','items']){await probe.evaluate(p=>window.bookReview.ui.open(p),p);await probe.locator(`.rb-page[data-book-page="${p}"]`).waitFor();assert.equal(await probe.locator('.rb-slot').count(),3);await probe.screenshot({path:`${out}/mobile-${p}.png`});functional.push(`${p}-three-canonical-slots`);}
  await probe.locator('[data-book-action="close"]').click();assert.equal(await probe.locator('.rinne-core-menu').isVisible(),false,'Closed menu leaves no frame');functional.push('no-closed-ghost-window');
  await probe.evaluate(()=>{const s=window.bookReview.fixture(0);window.bookReview.set(s);window.bookReview.ui.open('items')});
  assert.equal(await probe.locator('[data-book-action="equip"]').isDisabled(),true);await probe.screenshot({path:`${out}/newborn-equipment.png`});functional.push('newborn-seven-year-gate');
  await probe.evaluate(()=>{const s=window.bookReview.fixture();s.combat={training:false};window.bookReview.set(s);window.bookReview.ui.open('heart')});
  assert.equal(await probe.locator('[data-book-action="equip"]').isDisabled(),true);functional.push('combat-readonly');
  await probe.setViewportSize({width:360,height:520});await probe.evaluate(()=>{window.bookReview.set(window.bookReview.fixture());window.bookReview.ui.open('body')});await probe.screenshot({path:`${out}/small-body.png`});
  const bounds=await probe.locator('.rinne-primary-four').boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=360&&bounds.y+bounds.height<=520);functional.push('small-viewport-core-navigation');
  await probeContext.close();
  assert.equal(errors.length,0,errors.join('\n'));
  const receipt={schemaVersion:1,kind:'approved-ui-component-authoring',exactHead:head,referenceKind:'user-approved-original-images',roundsRequested:Number(input.rounds)||0,roundsExecuted:rounds.length,retained:rounds.filter(r=>r.accepted).length,reverted:rounds.filter(r=>!r.accepted).length,metric:'55% blurred-reference MAE + 45% normalized layout-anchor distance; not a claim of complete pixel identity',functional,params,rounds,calibrationCss:cssFor(),createdAt:new Date().toISOString(),scope:'Production menu controller and canonical game-state setters under isolated UI fixtures; this is not a no-injection full-life gameplay test.'};
  await writeFile(`${out}/receipt.json`,JSON.stringify(receipt,null,2));await writeFile(`${out}/proposed-calibration.css`,cssFor());
  // Store generated evidence, not application code. Source changes are applied by Connector after review.
  async function api(path,data,method){const r=await fetch(`https://api.github.com/repos/${repo}/${path}`,{method:method||(data?'POST':'GET'),headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});if(!r.ok)throw Error(`${path}: ${r.status} ${await r.text()}`);return r.json();}
  const rows=[];
  for(const name of ['receipt.json','proposed-calibration.css',...pages.flatMap(p=>[`initial-${p}.png`,`final-${p}.png`]),'mobile-technique.png','mobile-body.png','mobile-items.png','newborn-equipment.png','small-body.png']){
    const data=await readFile(`${out}/${name}`),sha=(await api('git/blobs',{content:data.toString('base64'),encoding:'base64'})).sha;rows.push({path:`docs/rinne/ui-reference-v6/evidence/${name}`,mode:'100644',type:'blob',sha});
  }
  const base=(await api(`git/commits/${head}`)).tree.sha,tree=(await api('git/trees',{base_tree:base,tree:rows})).sha;
  const commit=(await api('git/commits',{message:`承認UIの実ブラウザ比較記録: ${rounds.length}回、機能確認${functional.length}項目`,tree,parents:[head]})).sha;
  assert.equal((await api(`git/ref/heads/${branch}`)).object.sha,head,'Work branch moved during evidence generation');
  await api(`git/refs/heads/${branch}`,{sha:commit,force:false},'PATCH');console.log(JSON.stringify({evidenceCommit:commit,roundsExecuted:rounds.length,retained:receipt.retained,functional}));
}catch(error){await writeFile(`${out}/failure.json`,JSON.stringify({head,roundsExecuted:rounds.length,rounds,errors,error:String(error),stack:error.stack},null,2));throw error;}
finally{await writeFile(calibration,originalCss);await rm(harness,{force:true});await browser.close();await server.close();}
