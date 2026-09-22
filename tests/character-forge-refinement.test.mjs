import test from 'node:test';
import {execFileSync,spawnSync} from 'node:child_process';
test('Forge asymmetric side profiles and fail-closed refinement contract',{timeout:120000},()=>{
  const python=process.env.CHARACTER_FORGE_PYTHON||'python3';
  if(spawnSync(python,['-c','import PIL']).status!==0)execFileSync(python,['-m','pip','install','--user','-r','packages/assets/forge/requirements.txt'],{stdio:'inherit',timeout:90000});
  execFileSync(python,['scripts/character-forge/refinement-tests.py','-v'],{stdio:'inherit',timeout:60000});
});
