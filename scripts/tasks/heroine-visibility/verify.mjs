import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {verifyFemaleProtagonistVisibility,heroineSavedWorkspaceFixture} from '../../../apps/character-studio/tests/female-protagonist-visibility.browser.mjs';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const fixture=heroineSavedWorkspaceFixture();
 const before=await verifyFemaleProtagonistVisibility(browser,'https://soul-lineage-character-studio-dev.c-okamoto.workers.dev/','generated/heroine-visibility/before',{expectBroken:true,fixture});
 const after=await verifyFemaleProtagonistVisibility(browser,'http://127.0.0.1:5177/','generated/heroine-visibility/after',{projectRoot:process.cwd(),fixture});
 assert.equal(before.fixtureSha256,after.fixtureSha256);assert.equal(before.modelSha256,after.modelSha256);
 await writeFile('generated/heroine-visibility/result.json',JSON.stringify({checkoutSha:process.env.GITHUB_SHA,before,after,status:'saved-state regression reproduced and repaired'},null,2));
 console.log(JSON.stringify({before:before.views,after:after.views,modelUnchanged:true,savedEditorDataPreserved:true}));
} finally {await browser.close();}
