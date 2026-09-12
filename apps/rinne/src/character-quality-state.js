import { BASE_APPEARANCE_PARTS, VISUAL_ROLES, visualIdentityForCharacter, compareVisualIdentities } from '@soul/characters';
const defaults = { version: 1, mode: 'enhanced', context: 'village', role: 'mixed', reference: true, marked: [] };
const roles = { village: ['resident','mayor','guard','artisan','laborer','hunter','smith','acolyte','traveller'],
  demon: ['knight','hunter','arcanist','smith','acolyte','gravekeeper','bellkeeper','traveller'] };
const check = (ok, message) => { if (!ok) throw new Error(message); };
export function qualitySettings(input = {}, ids = null) {
  check(input && typeof input === 'object' && !Array.isArray(input), 'Invalid quality settings');
  const value = { ...defaults, ...input };
  check(Object.keys(value).every(key => Object.hasOwn(defaults,key)) && value.version === 1, 'Unsupported quality settings');
  check(['enhanced','baseline'].includes(value.mode) && ['studio','village','demon'].includes(value.context), 'Invalid quality preview');
  check(value.role === 'mixed' || Object.hasOwn(VISUAL_ROLES,value.role), 'Invalid quality role');
  check(typeof value.reference === 'boolean', 'Invalid Shino reference');
  check(Array.isArray(value.marked) && value.marked.length <= 30 && new Set(value.marked).size === value.marked.length, 'Invalid quality marks');
  check(value.marked.every(id => typeof id === 'string' && /^[a-zA-Z0-9._:-]{1,96}$/.test(id) && (!ids || ids.has(id))), 'Unknown marked individual');
  return { ...value, marked: [...value.marked] };
}
export function qualityIdentity(record, index, input, manual = null) {
  const quality = qualitySettings(input), categories = roles[quality.context] ?? roles.village;
  if (quality.mode === 'baseline' || quality.reference && index === 0) return null;
  return visualIdentityForCharacter(record, { role: quality.role === 'mixed' ? categories[index % categories.length] : quality.role, parts: manual });
}
export function qualityProfile(record, index, input, manual = null) {
  return manual ?? qualityIdentity(record,index,input)?.parts ?? BASE_APPEARANCE_PARTS;
}
/** Indices preserve the original cohort position when reporting a filtered/single view. */
export function qualityReport(records, input, profiles = new Map(), indices = null) {
  const quality = qualitySettings(input);
  check(indices === null || Array.isArray(indices) && indices.length === records.length, 'Invalid quality report indices');
  const rows = records.map((record,offset)=>{
    const index = indices?.[offset] ?? offset;
    return { id:record.id, identity:qualityIdentity(record,index,{...quality,mode:'enhanced'},profiles.get(record.id)) };
  }).filter(row=>row.identity);
  return { ...compareVisualIdentities(rows), referenceCount: records.length - rows.length, mode:quality.mode };
}
