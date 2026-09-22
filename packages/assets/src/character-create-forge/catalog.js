import {characterForgeCandidates as discoveredCandidates} from '../../generated/create-forge-registry.js';

const freeze=value=>Object.freeze(value);
function validManifest(manifest){
  return Boolean(manifest&&manifest.schemaVersion==='rinne.character-package/v1'&&manifest.representation==='3d'&&
    manifest.model?.path&&manifest.model?.sha256&&manifest.validationStatus==='passed'&&
    ['review-candidate','approved'].includes(manifest.reviewStatus));
}
export const characterForgeReviewCandidates=freeze(discoveredCandidates.filter(entry=>validManifest(entry?.manifest)).map(entry=>freeze(entry)));
export const characterForgeCandidateById=freeze(Object.fromEntries(characterForgeReviewCandidates.map(entry=>[entry.manifest.id,entry])));
export function requireCharacterForgeCandidate(id){
  const entry=characterForgeCandidateById[String(id||'')];
  if(!entry)throw new Error(`Unknown Character Create Forge candidate: ${id}`);
  return entry;
}
