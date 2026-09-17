import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareRinneEffects} from '../apps/rinne/scripts/prepare-effects.mjs';

export * from '../apps/rinne/scripts/prepare-effects.mjs';

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  prepareRinneEffects().then(rows=>console.log(`Effekseer: ${rows.length} pinned files verified`)).catch(error=>{console.error(error.message);process.exitCode=1;});
}
