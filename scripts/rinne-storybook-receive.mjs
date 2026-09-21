import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const input=JSON.parse(await readFile('.storybook-task-input.json','utf8'));
if(input.mode==='materialize'){
  const browser=await chromium.launch({headless:true});
  try{
    const context=await browser.newContext({acceptDownloads:true});
    const page=await context.newPage();
    const downloadPromise=page.waitForEvent('download',{timeout:30000});
    await page.goto(input.source).catch(e=>{if(!/Download is starting|ERR_ABORTED/.test(e.message))throw e;});
    const download=await downloadPromise;await download.saveAs('.storybook-source.zip');
    console.log('Approved attachment received by Chromium');
  }finally{await browser.close();}
}
