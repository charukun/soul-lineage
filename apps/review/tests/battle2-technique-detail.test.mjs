import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {generatedTechniqueCandidates} from '@soul/game-data';
import {techniqueDetail} from '@soul/johakyu-battle';
import {battle2TechniqueCatalog,battle2LearnedTechniqueRows} from '../src/nocturne/battle2-technique-catalog.js';

const here=dirname(fileURLToPath(import.meta.url));
const catalogSource=readFileSync(join(here,'../src/nocturne/battle2-technique-catalog.js'),'utf8');
const loadoutSource=readFileSync(join(here,'../src/nocturne/battle2-loadout.js'),'utf8');

test('序破急バトルの技詳細は共有契約だけで説明文を作る',()=>{
  const generated=generatedTechniqueCandidates({weapon:'sword'}).find(row=>row.steps.length>=2);
  assert.ok(generated);
  const shared=techniqueDetail(generated.id,{weapon:'sword'});
  assert.match(shared.summary,/動き:/);
  assert.match(shared.summary,/注意:/);
  assert.doesNotMatch(shared.summary,/\b(?:slash|diagonal|crosscut|back|thrust|forward|sideL|sideR|retreat)\b/);

  const learned=battle2LearnedTechniqueRows([generated.id],{weapon:'sword'});
  assert.equal(learned.length,1);
  assert.equal(learned[0].meta,shared.summary);

  const basic=battle2TechniqueCatalog({weapon:'sword'})[0];
  assert.ok(basic);
  assert.equal(basic.meta,techniqueDetail(basic.id,{weapon:'sword'}).summary);

  assert.match(catalogSource,/techniqueDetail\(row\.id/);
  assert.doesNotMatch(catalogSource,/KIND_LABELS|FOOTWORK_LABELS|battle2TechniqueDescription/);
  assert.match(loadoutSource,/techniqueDetail as sharedTechniqueDetail/);
  assert.match(loadoutSource,/sharedTechniqueDetail\(selection,/);
});
