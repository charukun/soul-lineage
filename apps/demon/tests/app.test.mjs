import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import {PROGRESS_KEY,buyUpgrade,freshProgress,huntPlan,readProgress,settleProgress,bodyStats} from '../src/hunt/balance.js';
test('portable app boots with injected platform locale without a browser', () => {
 const app = createApp({ locale: { language: 'en-US' } });
 assert.equal(app.world.id, 'village.foundation.v1'); assert.equal(app.language, 'en-US');
 const profile={[PROGRESS_KEY]:freshProgress()};profile[PROGRESS_KEY].essence=8;
 assert.equal(buyUpgrade(profile,'fang'),true);assert.equal(readProgress(profile).autoGrowth,false);
 const plan=huntPlan(profile);settleProgress(profile,'escaped',2,{carried:4,plan,targetEaten:false,returnVerified:true});
 assert.equal(readProgress(profile).autoGrowth,false,'manual growth choice must survive a successful return');
 assert.equal(bodyStats(profile,0).tempo,.96);
});
