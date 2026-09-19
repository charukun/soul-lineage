import {
  KAYKIT_LICENSE,
  KAYKIT_MODEL_BY_KEY,
  KAYKIT_SOURCE_REPOSITORY,
  KAYKIT_SOURCE_REVISION
} from '@soul/characters';
import { classifyReviewMotion } from './review-motion-catalog.js';
import { MOTION_LIBRARY_SOURCES } from './review-motion-sources.js';

const freeze=value=>Object.freeze(value);
const normalize=value=>String(value??'').trim();
const compact=value=>normalize(value).replace(/\s+/g,'_');

export function sourceMotionIdentity({repository,revision,path,upstreamClipName,upstreamClipIndex}){
  if(![repository,revision,path,upstreamClipName].every(value=>typeof value==='string'&&value.length)||!Number.isSafeInteger(upstreamClipIndex)||upstreamClipIndex<0){
    throw new Error('Complete source motion provenance is required');
  }
  return `${repository}@${revision}:${path}#${upstreamClipIndex}:${upstreamClipName}`;
}

function semanticVariationName(name=''){
  let key=compact(name);
  const tools=new Map([
    ['Chopping','Chop'],['Digging','Dig'],['Hammering','Hammer'],['Lockpicking','Lockpick'],
    ['Pickaxing','Pickaxe'],['Sawing','Saw'],['Working_A','Work_A'],['Working_B','Work_B'],['Working_C','Work_C'],
    ['Melee_Blocking','Melee_Block'],['Melee_2H_Attack_Spinning','Melee_2H_Attack_Spin']
  ]);
  if(tools.has(key))key=tools.get(key);
  key=key
    .replace(/_No_Loop$/i,'')
    .replace(/_Loop$/i,'')
    .replace(/_RM$/i,'')
    .replace(/_Rec$/i,'')
    .replace(/_(?:Longer|Long|Short)$/i,'')
    .replace(/_(?:Up|Down)$/i,'')
    .replace(/_(?:Left|Right)$/i,'_Side');
  return key.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
export function canonicalMotionVariationKey(name=''){return semanticVariationName(name);}

function exclusionReason(source,name,{baseline=false}={}){
  if(/^(?:A_)?T[-_]?Pose$/i.test(name))return 'reference pose, not a gameplay motion';
  if(/_Pose$/i.test(name))return 'static pose extraction, not a distinct motion';
  if(!baseline&&source.family==='kaykit'&&/^Ranged_[12]H_/i.test(name))return 'firearm-oriented ranged motion is outside the RINNE fantasy review target';
  if(!baseline&&source.family==='kaykit'&&/Running_HoldingRifle/i.test(name))return 'rifle locomotion is outside the RINNE fantasy review target';
  if(!baseline&&source.family==='kaykit'&&/^(?:Push_Ups|Sit_Ups)$/i.test(name))return 'modern exercise motion is outside the RINNE review target';
  if(!baseline&&source.family==='kaykit'&&/^EXPERIMENTAL_/i.test(name))return 'experimental transform clip is not production review material';
  if(source.family==='quaternius'&&/^(?:Dance_Loop|Driving_Loop)$/i.test(name))return 'modern dance/vehicle motion is outside the RINNE review target';
  if(source.family==='quaternius'&&/^Pistol_/i.test(name))return 'firearm motion is outside the RINNE fantasy review target';
  if(source.family==='quaternius'&&/TalkingPhone/i.test(name))return 'phone motion is outside the RINNE world target';
  if(source.family==='quaternius'&&/^Sword_Regular_Combo$/i.test(name))return 'composed combo duplicates component source motions for counting';
  return null;
}
function record(source,clip,runtime,{baseline=false}={}){
  const name=normalize(clip?.name)||`clip-${clip?.index??0}`;
  const row={
    sourceId:source.id,
    sourceFamily:source.family,
    sourceRepository:source.repository,
    sourceRevision:source.revision,
    sourcePath:source.path,
    upstreamClipName:name,
    upstreamClipIndex:Number(clip.index),
    license:source.license,
    licenseUrl:source.licenseUrl??null,
    licenseEvidence:source.licenseEvidence??null,
    originalSource:source.originalSource??null,
    author:source.author,
    immutableHash:`git-sha1:${source.gitBlobSha}`,
    sourceFileGitBlobSha:source.gitBlobSha,
    sourceSha256:source.sha256??null,
    sourceByteLength:Number(source.byteLength)||null,
    duration:Number.isFinite(Number(clip.duration))?Number(clip.duration):null,
    baseline:Boolean(baseline),
    runtime:freeze(runtime)
  };
  row.sourceIdentity=sourceMotionIdentity({
    repository:row.sourceRepository,revision:row.sourceRevision,path:row.sourcePath,
    upstreamClipName:row.upstreamClipName,upstreamClipIndex:row.upstreamClipIndex
  });
  row.variationKey=`${row.sourceFamily}:${semanticVariationName(row.upstreamClipName)}`;
  row.canonicalClipIdentity=row.variationKey;
  row.category=classifyReviewMotion(row.upstreamClipName);
  return freeze(row);
}
function baselineSource(){
  const source=KAYKIT_MODEL_BY_KEY.knight.source;
  return freeze({
    id:'kaykit-adventurers-embedded',
    family:'kaykit',
    repository:KAYKIT_SOURCE_REPOSITORY,
    revision:KAYKIT_SOURCE_REVISION,
    path:source.path,
    gitBlobSha:source.gitBlobSha,
    byteLength:source.byteLength,
    license:KAYKIT_LICENSE,
    licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',
    licenseEvidence:`https://github.com/${KAYKIT_SOURCE_REPOSITORY}/blob/${KAYKIT_SOURCE_REVISION}/addons/kaykit_character_pack_adventures/LICENSE.txt`,
    originalSource:'https://kaylousberg.com/game-assets/characters-adventurers',
    author:'Kay Lousberg / KayKit'
  });
}
function sourceRows(source,clips,{baseline=false}={}){
  const records=[],exclusions=[];
  for(const clip of clips){
    const row=record(source,clip,baseline
      ?{kind:'kaykit-embedded',sourceId:source.id,clipIndex:clip.index}
      :{kind:'pinned-motion-source',sourceId:source.id,clipIndex:clip.index,url:source.runtimeUrl,rig:source.rig},
      {baseline});
    const reason=exclusionReason(source,row.upstreamClipName,{baseline});
    if(reason)exclusions.push(freeze({record:row,reason}));
    else records.push(row);
  }
  return freeze({records:freeze(records),exclusions:freeze(exclusions)});
}
export function kaykitMotionRecords(animations=[]){
  const source=baselineSource();
  return sourceRows(source,animations.map((clip,index)=>({index,name:normalize(clip?.name)||`clip-${index}`,duration:Number(clip?.duration)})),{baseline:true});
}
export function externalMotionRecords(){
  const records=[],exclusions=[];
  for(const source of MOTION_LIBRARY_SOURCES){
    const rows=sourceRows(source,source.clips);
    records.push(...rows.records);exclusions.push(...rows.exclusions);
  }
  return freeze({records:freeze(records),exclusions:freeze(exclusions)});
}
export function dedupeSourceMotions(records=[]){
  const sourceIds=new Map(),canonical=new Map(),motions=[],duplicates=[];
  for(const row of records){
    if(!row?.sourceIdentity||!row?.canonicalClipIdentity)throw new Error('sourceIdentity and canonicalClipIdentity are required');
    if(sourceIds.has(row.sourceIdentity)){
      duplicates.push(freeze({duplicate:row,kept:sourceIds.get(row.sourceIdentity),reason:'same-source-clip'}));
      continue;
    }
    const prior=canonical.get(row.canonicalClipIdentity);
    if(prior){
      sourceIds.set(row.sourceIdentity,prior);
      duplicates.push(freeze({duplicate:row,kept:prior,reason:'same-family-variation'}));
      continue;
    }
    sourceIds.set(row.sourceIdentity,row);canonical.set(row.canonicalClipIdentity,row);motions.push(row);
  }
  return freeze({motions:freeze(motions),duplicates:freeze(duplicates)});
}
export function buildReviewMotionRegistry(kaykitAnimations=[]){
  if(!Array.isArray(kaykitAnimations)||!kaykitAnimations.length)throw new Error('KayKit source animations are required');
  const baseline=kaykitMotionRecords(kaykitAnimations),external=externalMotionRecords();
  const baselineDeduped=dedupeSourceMotions(baseline.records);
  const combined=dedupeSourceMotions([...baseline.records,...external.records]);
  const byId=freeze(Object.fromEntries(combined.motions.map(row=>[row.sourceIdentity,row])));
  const exclusions=freeze([...baseline.exclusions,...external.exclusions]);
  const externalSourceClipOccurrences=MOTION_LIBRARY_SOURCES.reduce((sum,row)=>sum+row.clips.length,0);
  return freeze({
    version:2,
    motions:combined.motions,
    byId,
    duplicates:combined.duplicates,
    exclusions,
    sourceMotionCount:combined.motions.length,
    existingSourceMotionCount:baselineDeduped.motions.length,
    addedSourceMotionCount:combined.motions.filter(row=>!row.baseline).length,
    baselineClipOccurrences:kaykitAnimations.length,
    externalSourceClipOccurrences,
    duplicateSourceClipCount:combined.duplicates.length,
    excludedSourceClipCount:exclusions.length
  });
}
export function motionRegistryCount(registry){
  if(!registry||!Array.isArray(registry.motions))throw new Error('Motion registry is required');
  return new Set(registry.motions.map(row=>row.sourceIdentity)).size;
}
