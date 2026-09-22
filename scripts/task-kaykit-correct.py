# Correct defects proven by the second real browser observation.
from pathlib import Path
root=Path.cwd()
def change(file,old,new):
 p=root/file;s=p.read_text();assert old in s,'Source drift: '+file;p.write_text(s.replace(old,new))
change('apps/rinne/src/review/shared/runtime-thumbnail.js','const job=jobs.shift();queuedKeys.delete(job.key);','const job=jobs.shift();\n    // The queue can be cleared after scheduling this idle callback.\n    if(!job){active=false;return;}\n    queuedKeys.delete(job.key);')
change('apps/character-studio/src/review/character/main.js','if (model.thumbnailUrl) b.dataset.thumbnailUrl = model.thumbnailUrl;','if (model.thumbnailUrl && !model.legacyVersion) b.dataset.thumbnailUrl = model.thumbnailUrl;')
change('apps/rinne/src/review/motion/entrypoint.js',"if(model.thumbnailUrl){\n    const image=document.createElement('img');","if(model.thumbnailUrl){\n    if(model.legacyVersion)return createStaticThumbnail(model.thumbnailUrl,model.label);\n    const image=document.createElement('img');")
change('apps/rinne/tests/review-kaykit-library.test.mjs',"assert.doesNotMatch(block,/createStaticThumbnail\\(model\\.thumbnailUrl/);","assert.match(block,/if\\(model\\.legacyVersion\\)return createStaticThumbnail/);")
change('scripts/browser/kaykit-library.mjs',"page.on('pageerror',e=>receipt.errors.push(e.message));","page.on('pageerror',e=>receipt.errors.push(e.stack||e.message));page.on('response',r=>{if(r.status()>=400)receipt.errors.push(`HTTP ${r.status()} ${r.url()}`);});")
change('scripts/browser/kaykit-library.mjs',"window.characterStudio?.review?.ready&&document.querySelectorAll('.character-model-card').length>=17","window.characterStudio?.review?.ready&&window.characterStudio.review.displayModelId&&window.characterStudio.review.audit?.modelId===window.characterStudio.review.displayModelId&&document.querySelectorAll('.character-model-card').length>=17")
change('scripts/browser/kaykit-library.mjs','await button.scrollIntoViewIfNeeded();await button.click();','await button.click();')
print('Fixed cancelled thumbnail jobs and mixed raster/SVG consumers; native input waits for audited initial Studio selection')
