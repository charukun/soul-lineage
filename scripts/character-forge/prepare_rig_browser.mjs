// UNVALIDATED PREPARATION: preserved at user-requested pause; not executed on Scout.
/** Export the actual accepted reconstruction in attach space, before freeze. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {withWorkspaceBrowser,loadReconstructionModule} from './browser_workspace.mjs';
const workspace=resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('An accepted reconstruction workspace is required');
const spec=JSON.parse(await readFile(join(workspace,'object-sculpt-spec.json'),'utf8'));
if(JSON.stringify(spec.sculptPipeline.completedPasses)!==JSON.stringify(spec.sculptPipeline.passOrder))throw Error('All eight real reconstruction passes must be accepted first');
const review=JSON.parse(await readFile(join(workspace,'review/optimization-pass/agent-review.json'),'utf8'));
if(review.action!=='continue'||review.qualityFloorPassed!==true)throw Error('An actual raw-likeness Quality Floor review is required');
const out=join(workspace,'review/pre-rig');await mkdir(out,{recursive:true});
const app=loadReconstructionModule+`
import {prepareAttachSpace,meshPayload} from '/adapters/three_rig_adapter.js';
window.forge={draw,async prepare(){root.rotation.y=0;root.updateMatrixWorld(true);const metrics=prepareAttachSpace(THREE,root);if(metrics.maxPositionRoundingDelta>1e-6)throw Error('Attach preparation changed the accepted world-space form');await captureJson('meshes-before',meshPayload(root));await captureJson('attach-preparation',metrics);return metrics;}};window.ready=true;`;
const views=['front','side','back','front34','rear34','oppositeSide'];
await withWorkspaceBrowser(workspace,app,async page=>{
 for(const view of views){await page.evaluate(v=>window.forge.draw(v),view);await page.locator('canvas').screenshot({path:join(out,view+'-before.png')});}
 await page.evaluate(()=>window.forge.prepare());
 for(const view of views){await page.evaluate(v=>window.forge.draw(v),view);await page.locator('canvas').screenshot({path:join(out,view+'-after.png')});}
});
const sha=async path=>createHash('sha256').update(await readFile(join(workspace,path))).digest('hex');
await writeFile(join(out,'receipt.json'),JSON.stringify({sourceHead:process.env.HEAD_SHA,reviewId:review.id,modelSha256:await sha('build/optimization-pass.glb'),meshPayloadSha256:await sha('build/rig/meshes-before.json'),views,scope:'Actual pre-freeze attachment-space preparation; pixel parity must pass before freeze or binding'},null,2));
