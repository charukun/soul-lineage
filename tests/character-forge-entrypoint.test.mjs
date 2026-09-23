import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('default Forge CLI enters the upstream workspace and rejects legacy authoring flags',()=>{
  const help=spawnSync(process.execPath,['scripts/character-forge/create.mjs','--help'],{encoding:'utf8'});
  assert.equal(help.status,0);assert.match(help.stdout,/upstream_workspace/);assert.match(help.stdout,/create,next,run,mark/);
  const old=spawnSync(process.execPath,['scripts/character-forge/create.mjs','--workspace','unused','--analysis','old-loft.json'],{encoding:'utf8'});
  assert.notEqual(old.status,0);assert.match(old.stderr,/Unexpected arguments/);
});

test('legacy reconstruction cannot run unless explicitly selected by compatibility tests',()=>{
  const result=spawnSync(process.env.CHARACTER_FORGE_PYTHON||'python3',['packages/assets/forge/pipeline.py','--id','blocked','--name','Blocked','--provenance','must-not-be-opened.json'],{encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/Legacy reconstruction is disabled/);
});
