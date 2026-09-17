export const CHARACTER_LICENSE_POLICY_VERSION = 1;
export const CHARACTER_LICENSE_ALLOWED_EXTERNAL = Object.freeze(['CC0-1.0']);
export const CHARACTER_LICENSE_ALLOWED_OWNERSHIP = 'RINNE-owned';
export const RETIRED_CONDITIONAL_CHARACTER_IDS = Object.freeze([
  'character.sendagaya-shino.v1',
  'shino.reference.v2',
  'review.vroid-a',
  'review.vroid-b',
  'review.vroid-c',
  'review.tsukuyomi-type-a'
]);
export const BLOCKED_RERIG_CHARACTER_IDS = Object.freeze([
  'arcanist.atlas-dcc.v1'
]);
export const NON_DISTRIBUTABLE_CHARACTER_FILES = Object.freeze([
  'apps/rinne/public/simulator/assets/A_review.vrm',
  'apps/rinne/public/simulator/assets/B_review.vrm',
  'apps/rinne/public/simulator/assets/C_review.vrm',
  'apps/rinne/public/simulator/assets/SHINO_review.vrm',
  'apps/rinne/public/simulator/assets/TSUKU_review.vrm',
  'apps/rinne/public/simulator/assets/SHINO_REFERENCE_V2.vrm',
  'apps/rinne/public/simulator/assets/SHINO_REFERENCE_V2.asset.json',
  'apps/rinne/public/simulator/assets/ARCANIST_ATLAS_DCC.glb',
  'apps/rinne/public/simulator/assets/ARCANIST_ATLAS_DCC.asset.json',
  'apps/rinne/public/simulator/assets/portrait_A.webp',
  'apps/rinne/public/simulator/assets/portrait_B.webp',
  'apps/rinne/public/simulator/assets/portrait_C.webp',
  'apps/rinne/public/simulator/assets/portrait_SHINO.webp',
  'apps/rinne/public/simulator/assets/portrait_TSUKU.webp'
]);
export const CONDITIONAL_CHARACTER_RIG_IDS = Object.freeze(['humanoid.shino-vrm1.v2']);

const normalize = value => String(value ?? '').trim().toLowerCase();
const conditionalTerms = value => /sendagaya|shino|vroid|tsukuyomi|つくよみ|vrm[- ]?public[- ]?license/.test(normalize(value));

function licenseStrings(license) {
  if (typeof license === 'string') return [license];
  if (!license || typeof license !== 'object' || Array.isArray(license)) return [];
  return Object.values(license).flatMap(value => typeof value === 'string' ? [value] : []);
}

export function evaluateCharacterLicensePolicy({
  id = '',
  license = null,
  ownership = '',
  rigId = '',
  rigProvenance = ''
} = {}) {
  if (RETIRED_CONDITIONAL_CHARACTER_IDS.includes(id)) {
    return Object.freeze({ status: 'retired', allowed: false, reason: 'retired-conditional-character' });
  }
  if (BLOCKED_RERIG_CHARACTER_IDS.includes(id) || CONDITIONAL_CHARACTER_RIG_IDS.includes(rigId) || conditionalTerms(rigProvenance)) {
    return Object.freeze({ status: 'blocked-rerig', allowed: false, reason: 'conditional-carrier-rig' });
  }
  if (ownership === CHARACTER_LICENSE_ALLOWED_OWNERSHIP) {
    return Object.freeze({ status: 'allowed', allowed: true, reason: 'rinne-owned' });
  }
  const terms = licenseStrings(license);
  if (terms.length === 1 && CHARACTER_LICENSE_ALLOWED_EXTERNAL.includes(terms[0])) {
    return Object.freeze({ status: 'allowed', allowed: true, reason: 'cc0' });
  }
  if (terms.some(conditionalTerms)) {
    return Object.freeze({ status: 'conditional', allowed: false, reason: 'model-specific-license-conditions' });
  }
  return Object.freeze({ status: 'unknown', allowed: false, reason: 'unverified-license' });
}

export function assertCharacterLicenseAllowed(asset) {
  const result = evaluateCharacterLicensePolicy(asset);
  if (!result.allowed) throw new Error(`Character asset license rejected: ${result.reason}`);
  return result;
}
