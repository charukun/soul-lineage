// Source identities describe upstream assets, never playback/retarget settings.
// The explicit aliases below are conservative: an uncertain derivative is not
// promoted to another motion merely because its filename or duration changed.
export const MOTION_IDENTITY_VERSION = 1;
const SHA = /^[a-f0-9]{40}$/;
export function safeMotionPath(value) {
  return typeof value === 'string' && /^\.\/simulator\/assets\/[A-Za-z0-9_./-]+\.(glb|json)$/.test(value)
    && !value.includes('..') && !value.includes('//');
}
export function sourceMotionIdentity(value) {
  const source = value?.canonicalSource || value?.source || value;
  if (!source || !source.repository || !SHA.test(source.revision || '') || !source.path
      || !Number.isSafeInteger(source.clipIndex) || source.clipIndex < 0 || !source.clipName) {
    throw new Error('Incomplete immutable source motion identity');
  }
  return JSON.stringify([source.repository, source.revision, source.path, source.clipName, source.clipIndex]);
}
export function countSourceMotions(rows = []) {
  return new Set(rows.map(sourceMotionIdentity)).size;
}
export function sourceProvenance(source, clip) {
  return Object.freeze({ repository: source.repository, revision: source.revision, path: source.path,
    clipName: clip.name, clipIndex: clip.index, gitBlobSha: source.gitBlobSha,
    sha256: source.sha256, clipFingerprint: clip.fingerprint, author: source.author,
    license: source.license, licenseUrl: source.licenseUrl, originalSource: source.originalSource });
}

function kaykitName(name) {
  let n = name.replace(/^(1H|2H)_Melee_/, 'Melee_$1_')
    .replace(/^Dualwield_Melee_/, 'Melee_Dualwield_')
    .replace(/^Unarmed_Melee_/, 'Melee_Unarmed_')
    .replace(/^(1H|2H)_Ranged_/, 'Ranged_$1_');
  const aliases = {
    Idle: 'Idle_A', Cheer: 'Cheering', Block: 'Melee_Block', Blocking: 'Melee_Block',
    Block_Attack: 'Melee_Block_Attack', Block_Hit: 'Melee_Block_Hit',
    Melee_Blocking: 'Melee_Block', Unarmed_Idle: 'Melee_Unarmed_Idle',
    Unarmed_Pose: 'Melee_Unarmed_Idle',
    Spellcast_Long: 'Ranged_Magic_Spellcasting_Long', Spellcast_Raise: 'Ranged_Magic_Raise',
    Spellcast_Shoot: 'Ranged_Magic_Shoot', Spellcasting: 'Ranged_Magic_Spellcasting',
    Death_A_Pose: 'Death_A', Death_B_Pose: 'Death_B', Lie_Pose: 'Lie_Idle',
    Sit_Chair_Pose: 'Sit_Chair_Idle', Sit_Floor_Pose: 'Sit_Floor_Idle',
    Jump_Full_Short: 'Jump_Full_Long', Jump_Start: 'Jump_Full_Long',
    Jump_Idle: 'Jump_Full_Long', Jump_Land: 'Jump_Full_Long',
    Dodge_Right: 'Dodge_Left', Running_Strafe_Right: 'Running_Strafe_Left',
    Chopping: 'Chop', Digging: 'Dig', Hammering: 'Hammer',
    Lockpicking: 'Lockpick', Pickaxing: 'Pickaxe', Sawing: 'Saw',
    Working_A: 'Work_A', Working_B: 'Work_B', Working_C: 'Work_C',
    Skeletons_Taunt_Longer: 'Skeletons_Taunt'
  };
  n = aliases[n] || n;
  return n.replace(/_Shooting$/, '_Shoot').replace(/_Spinning$/, '_Spin');
}
function universalName(name) {
  const n = name.replace(/_RM$/, '');
  if (/^Sword_Regular_/.test(n)) return 'Sword_Regular_Combo';
  if (/^Melee_Hook(_Rec)?$/.test(n)) return 'Melee_Hook_Rec';
  if (/^Jump_(Start|Loop|Land)$/.test(n)) return 'Jump_Loop';
  if (/^NinjaJump_(Start|Idle_Loop|Land)$/.test(n)) return 'NinjaJump_Idle_Loop';
  if (/^Slide_(Start|Loop|Exit)$/.test(n)) return 'Slide_Loop';
  return n;
}
export function motionFamilyKey(source, clip) {
  return `${source.family}:${source.family === 'kaykit' ? kaykitName(clip.name) : universalName(clip.name)}`;
}
export function sourceExclusion(source, clip) {
  if (/^(A_)?T[-_]?Pose$/i.test(clip.name)) return 'static bind pose, not a motion';
  if (source.family === 'quaternius' && /Dance|Driving|Pistol|TalkingPhone/i.test(clip.name)) {
    return 'modern dance, driving, handgun or phone action outside the requested game world';
  }
  if (/EXPERIMENTAL|Skeletons_(Awaken|Death|Inactive|Spawn)/i.test(clip.name)) {
    return 'skeleton disassembly, deformation or experimental rig action is unsafe on living KayKit characters';
  }
  if (source.family === 'kaykit' && /HoldingRifle/.test(clip.name)) return 'modern rifle locomotion';
  return null;
}
function representativeRank(source, clip) {
  if (source.baseline) return 0;
  const canonical = source.family === 'kaykit' ? kaykitName(clip.name) : universalName(clip.name);
  return canonical === clip.name ? 1 : 2;
}
export function buildSourceMotionRegistry(inventory) {
  const families = new Map(), excluded = [], legacy = [];
  for (const item of inventory) {
    const source = { ...item.source, sha256: item.sha256 };
    if (!source.license || !source.author || !SHA.test(source.gitBlobSha || '') || !/^[a-f0-9]{64}$/.test(source.sha256 || '') || !safeMotionPath(source.url)) {
      throw new Error(`Incomplete motion provenance: ${source.id}`);
    }
    for (const clip of item.clips) {
      const provenance = sourceProvenance(source, clip), reason = sourceExclusion(source, clip);
      const candidate = { name: clip.name, duration: clip.duration, sourceId: source.id, url: source.url,
        source: provenance, sourceIdentity: sourceMotionIdentity(provenance), baseline: Boolean(source.baseline),
        fingerprint: clip.fingerprint, family: source.family };
      if (source.baseline) legacy.push(candidate);
      if (reason) { excluded.push({ ...candidate, reason }); continue; }
      const key = motionFamilyKey(source, clip), rank = representativeRank(source, clip);
      const group = families.get(key) || { key, candidates: [] };
      group.candidates.push({ ...candidate, rank }); families.set(key, group);
    }
  }
  const records = [], byFingerprint = new Map();
  for (const { key, candidates } of families.values()) {
    candidates.sort((a, b) => a.rank - b.rank || a.sourceId.localeCompare(b.sourceId) || a.source.clipIndex - b.source.clipIndex);
    const first = candidates[0], existing = byFingerprint.get(first.fingerprint);
    const aliases = candidates.slice(1).map(({ rank, ...row }) => ({ ...row, reason: 'same source family: model embedding, renamed export, mirror, loop, root-motion or partial clip' }));
    if (existing) { existing.aliases.push({ ...first, reason: 'identical normalized source channel fingerprint' }, ...aliases); existing.baseline ||= candidates.some(row => row.baseline); continue; }
    const record = { ...first, familyKey: key, aliases, baseline: candidates.some(row => row.baseline) };
    delete record.rank;
    records.push(record); byFingerprint.set(first.fingerprint, record);
  }
  for (const [index, row] of records.entries()) { row.index = index; row.id = `${row.sourceId}:${row.source.clipIndex}`; }
  if (countSourceMotions(records) !== records.length) throw new Error('Duplicate canonical source identity');
  return { version: MOTION_IDENTITY_VERSION, records, legacy, excluded,
    summary: { baseline: records.filter(row => row.baseline).length,
      added: records.filter(row => !row.baseline).length, total: countSourceMotions(records),
      duplicateOccurrences: records.reduce((sum, row) => sum + row.aliases.length, 0), excludedOccurrences: excluded.length } };
}
