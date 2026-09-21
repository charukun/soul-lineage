import {KAYKIT_MODELS} from '@soul/characters';
import {MOTION_LIBRARY_SOURCES} from './review-motion-sources.js';

const freeze=value=>Object.freeze(value);
const IDENTITY=freeze([0,0,0,1]);
const RIG_CALIBRATIONS=freeze({
  'kaykit-rig-medium':freeze({id:'kaykit-rig-medium-v1',basis:IDENTITY,mapping:freeze({}),constraintPreset:'stylized-humanoid'}),
  'quaternius-standard':freeze({id:'quaternius-standard-v1',basis:IDENTITY,mapping:freeze({}),constraintPreset:'standard-humanoid'}),
  'mesh2motion-human':freeze({id:'mesh2motion-human-v1',basis:IDENTITY,mapping:freeze({}),constraintPreset:'standard-humanoid'}),
  'cmu-bvh':freeze({id:'cmu-bvh-v1',basis:IDENTITY,mapping:freeze({}),constraintPreset:'mocap-humanoid'})
});
const familyOf=row=>{
  const raw=row?.rig||row?.rigId||'';
  if(raw==='Rig_Medium')return 'kaykit-rig-medium';
  return raw;
};
const descriptor=row=>{
  const assetHash=row?.source?.gitBlobSha||row?.gitBlobSha||'';
  const rigFamily=familyOf(row),calibration=RIG_CALIBRATIONS[rigFamily]||freeze({id:'generic-upright-v1',basis:IDENTITY,mapping:freeze({}),constraintPreset:'generic-humanoid'});
  return freeze({
    version:1,
    assetHash,
    rigFamily,
    calibrationId:calibration.id,
    basis:calibration.basis,
    mapping:calibration.mapping,
    constraintPreset:calibration.constraintPreset,
    adapterApproved:true,
    visualApproval:'pending',
    productionReady:false
  });
};
const rows=[...KAYKIT_MODELS,...MOTION_LIBRARY_SOURCES];
export const REVIEW_HUMANOID_DESCRIPTOR_BY_HASH=freeze(Object.fromEntries(rows.map(row=>{
  const d=descriptor(row);return[d.assetHash,d];
}).filter(([hash])=>/^[a-f0-9]{40}$/.test(hash))));
export function resolveReviewHumanoidDescriptor(row){
  const hash=row?.source?.gitBlobSha||row?.gitBlobSha||'';
  return REVIEW_HUMANOID_DESCRIPTOR_BY_HASH[hash]||descriptor(row);
}
export function createRigRequiredDccRoute(model,compatibility){
  if(compatibility?.status!=='RIG_REQUIRED')return null;
  const raw=String(model?.key||model?.id||'review-character').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'review-character';
  return freeze({
    status:'RIG_REQUIRED',
    branch:'dcc/'+raw,
    carrier:'Character DCC Carrier',
    authoredInputs:[`assets/characters/${raw}/reference.*`,`assets/characters/${raw}/build.py`],
    sourceAssetHash:model?.source?.gitBlobSha||null,
    foundation:'KayKit Rig_Medium',
    requiredOutput:'weighted GLB/VRM with audited shared humanoid rig',
    productionReady:false,
    visualApproval:'pending'
  });
}
