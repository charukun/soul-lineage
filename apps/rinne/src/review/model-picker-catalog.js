const DEVELOP_REFERENCE_REVISION='d8bc6d3814bca199d33c53783b1d1386405d8614';
const KAYKIT_REVISION='672074b73ba276876a19e8816ecdc5241817ab47';
const KAYKIT_REPOSITORY='KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0';
const KAYKIT_SAMPLE_BASE=`https://raw.githubusercontent.com/${KAYKIT_REPOSITORY}/${KAYKIT_REVISION}/addons/kaykit_character_pack_adventures/Samples`;
const RINNE_REFERENCE_BASE=`https://raw.githubusercontent.com/charukun/soul-lineage/${DEVELOP_REFERENCE_REVISION}`;

export const MODEL_PICKER_PRESENTATION=Object.freeze({
  'model.SHINO_SLENDER':Object.freeze({pickerHidden:true,pickerCanonicalId:'model.SHINO'}),
  'model.SHINO_STURDY':Object.freeze({pickerHidden:true,pickerCanonicalId:'model.SHINO'}),
  'model.SHINO_COMPACT':Object.freeze({pickerHidden:true,pickerCanonicalId:'model.SHINO'}),
  'arcanist.atlas-study.v1':Object.freeze({
    pickerLabel:'Arcanist / BLOCKOUT',
    portraitPath:`${RINNE_REFERENCE_BASE}/docs/characters/references/npc-role-set/arcanist.avif`,
    portraitFocus:'face'
  }),
  'motion-library.knight':Object.freeze({pickerLabel:'KayKit CC0 / Knight',portraitPath:`${KAYKIT_SAMPLE_BASE}/knight.png`,portraitFocus:'face'}),
  'motion-library.barbarian':Object.freeze({pickerLabel:'KayKit CC0 / Barbarian',portraitPath:`${KAYKIT_SAMPLE_BASE}/barbarian.png`,portraitFocus:'face'}),
  'motion-library.mage':Object.freeze({pickerLabel:'KayKit CC0 / Mage',portraitPath:`${KAYKIT_SAMPLE_BASE}/mage.png`,portraitFocus:'face'}),
  'motion-library.rogue':Object.freeze({pickerLabel:'KayKit CC0 / Rogue',portraitPath:`${KAYKIT_SAMPLE_BASE}/rogue.png`,portraitFocus:'face'}),
  'motion-library.rogue-hooded':Object.freeze({pickerHidden:true,pickerCanonicalId:'motion-library.rogue'})
});

export function presentModelPickerRow(row){
  if(!row?.id)return row;
  return Object.freeze({...row,...(MODEL_PICKER_PRESENTATION[row.id]||{})});
}

export function visibleModelPickerRows(rows){
  return (rows||[]).map(presentModelPickerRow).filter(row=>row&&!row.pickerHidden);
}

export function modelPickerPortrait(row){
  const presented=presentModelPickerRow(row);
  if(!presented)return null;
  if(presented.portraitPath)return presented.portraitPath;
  if(presented.portrait)return `./simulator/assets/portrait_${presented.portrait}.webp`;
  return null;
}

export function modelPickerInitials(row){
  const text=String(row?.name||row?.label||row?.id||'?').replace(/^Motion Library\s*\/\s*/i,'').trim();
  const parts=text.split(/\s+/).filter(Boolean);
  return (parts.length>1?parts.map(part=>part[0]).join(''):text.slice(0,2)).slice(0,3).toUpperCase()||'?';
}
