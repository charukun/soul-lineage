const DEVELOP_REFERENCE_REVISION='d8bc6d3814bca199d33c53783b1d1386405d8614';
const KAYKIT_REVISION='672074b73ba276876a19e8816ecdc5241817ab47';
const KAYKIT_REPOSITORY='KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0';
const KAYKIT_SAMPLE_BASE=`https://raw.githubusercontent.com/${KAYKIT_REPOSITORY}/${KAYKIT_REVISION}/addons/kaykit_character_pack_adventures/Samples`;
const RINNE_REFERENCE_BASE=`https://raw.githubusercontent.com/charukun/soul-lineage/${DEVELOP_REFERENCE_REVISION}`;
let pickerStyleInstalled=false;

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

function installPickerPortraitStyle(){
  if(pickerStyleInstalled||typeof document==='undefined')return;
  const style=document.createElement('style');
  style.id='model-picker-portrait-style';
  style.textContent=`
    .unified-review-navigation .model-picker-item .model-picker-portrait{width:38px!important;height:38px!important;justify-self:center!important;display:grid!important;place-items:center!important;overflow:hidden!important;border-radius:9px!important;background:#0b1014!important;box-shadow:0 5px 14px #0008!important;white-space:normal!important;-webkit-line-clamp:unset!important;-webkit-box-orient:initial!important}
    .unified-review-navigation .model-picker-item .model-picker-portrait img{width:100%!important;height:100%!important;border-radius:0!important;object-fit:cover!important;background:#0b1014!important}
    .unified-review-navigation .model-picker-item .model-picker-portrait img[data-focus="face"]{transform:scale(2.15);transform-origin:50% 18%}
    .unified-review-navigation .model-picker-item .model-picker-portrait-fallback{width:100%!important;height:100%!important;display:grid!important;place-items:center!important;background:radial-gradient(circle at 50% 34%,#3a4650 0 22%,#1a2229 23% 42%,#0d1217 43%)!important;color:#b8c0c5!important;font:800 10px/1 ui-sans-serif,system-ui!important;letter-spacing:.08em!important;-webkit-line-clamp:unset!important}
    .unified-review-navigation .model-picker-item .model-picker-copy{display:block!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:8px!important;line-height:1.2!important;white-space:normal!important;-webkit-line-clamp:unset!important;-webkit-box-orient:initial!important}
    .unified-review-navigation .model-picker-item .model-picker-copy small{display:block!important;font-size:6px!important;line-height:1.15!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    @media(max-width:430px){.unified-review-navigation .model-picker-item .model-picker-portrait{width:32px!important;height:32px!important}}
  `;
  document.head.append(style);pickerStyleInstalled=true;
}

export function presentModelPickerRow(row){
  if(!row?.id)return row;
  return Object.freeze({...row,...(MODEL_PICKER_PRESENTATION[row.id]||{})});
}

export function visibleModelPickerRows(rows){
  installPickerPortraitStyle();
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
