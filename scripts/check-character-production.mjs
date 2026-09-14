import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CHARACTER_REFERENCE_MODELS,
  evaluateCharacterProduction,
  referenceModelProductionStage
} from '@soul/characters';

const productionDir = resolve('packages/characters/production');
const failures = [];
const reports = [];

for (const [id, model] of Object.entries(CHARACTER_REFERENCE_MODELS)) {
  const implied = referenceModelProductionStage(model);
  if (!model.productionStage) failures.push(`${id}: productionStage is required`);
  else if (model.productionStage !== implied) failures.push(`${id}: productionStage ${model.productionStage} disagrees with ${implied}`);
  if (!model.modelingMode) failures.push(`${id}: modelingMode is required`);
  if (model.productionReady === true && model.productionStage !== 'RUNTIME_READY') failures.push(`${id}: productionReady=true requires RUNTIME_READY`);
  if (model.kind === 'runtime-reference-model') {
    if (model.modelingMode !== 'runtime-procedural') failures.push(`${id}: runtime-reference-model must be runtime-procedural until rebuilt in DCC`);
    if (model.productionStage !== 'BLOCKOUT') failures.push(`${id}: runtime-reference-model is BLOCKOUT, never production-ready`);
  }
}

for (const name of readdirSync(productionDir).filter(name => name.endsWith('.production.json')).sort()) {
  const path = resolve(productionDir, name);
  let manifest;
  try { manifest = JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { failures.push(`${name}: invalid JSON: ${error.message}`); continue; }
  try {
    const result = evaluateCharacterProduction(manifest, manifest.stage);
    reports.push({ file: name, ...result });
    if (!result.ok) failures.push(`${name}: ${result.missing.join('; ')}`);
    const catalogModel = CHARACTER_REFERENCE_MODELS[manifest.id];
    if (catalogModel && catalogModel.productionStage !== manifest.stage) failures.push(`${name}: catalog stage ${catalogModel.productionStage} != manifest stage ${manifest.stage}`);
  } catch (error) { failures.push(`${name}: ${error.message}`); }
}

const output = {
  schema: 'character-production-check',
  version: 1,
  manifests: reports.map(({ file, id, declaredStage, modelingMode, maximumStage, highestEligibleStage, productionReady }) => ({ file, id, declaredStage, modelingMode, maximumStage, highestEligibleStage, productionReady })),
  catalogModels: Object.keys(CHARACTER_REFERENCE_MODELS).length,
  ok: failures.length === 0,
  failures
};

console.log(JSON.stringify(output, null, 2));
if (failures.length) process.exitCode = 1;
