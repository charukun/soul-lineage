export const REVIEW_REFERENCE_MODEL_HEIGHT=1.95;

const CATEGORY_SCALE=Object.freeze({attack:.68,impact:.52,support:.82,elemental:.76,finisher:1.05,combo:.86});
const AUTHOR_SCALE=Object.freeze({AndrewFM:.80,NextSoft:.82,Pierre:.60,Suzuki:.78,tktk:.92,MAGICALxSPIRAL:.88,Effekseer:.86,KTK_kumamoto:.82,Hanmado:.78});
const SPECIAL_SCALE=Object.freeze([
  [/Meteor|Meteo|boss_death|HolySandstorm|LightningStrike|GateOfCalve|Sword_Storm/i,.72],
  [/Sword|Spear|Claw|Arrow|Gun|Ribbon|drill|BloodLance|Laser/i,.90],
  [/Blow|hit_eff|Impact|SonicBoom|MonsterRoar|parts_hit|hanmado/i,.82],
  [/HealPotion|MagicHeal|PowerUp|Benediction|Shield|magic_circle|Cure|hozyo|Aura|Barrior|ForceField/i,.95],
]);

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const round=value=>Math.round(value*1000)/1000;

export function reviewModelScale(entry,modelHeight=REVIEW_REFERENCE_MODEL_HEIGHT){
  if(!entry?.realSource)return 1;
  const safeHeight=Number.isFinite(modelHeight)&&modelHeight>0?modelHeight:REVIEW_REFERENCE_MODEL_HEIGHT;
  const heightRatio=safeHeight/REVIEW_REFERENCE_MODEL_HEIGHT;
  const category=CATEGORY_SCALE[entry.category]??.8;
  const author=AUTHOR_SCALE[entry.author]??.85;
  const special=SPECIAL_SCALE.find(([pattern])=>pattern.test(entry.sourcePath||entry.label||''))?.[1]??1;
  return round(clamp(heightRatio*category*author*special,.28,1.45));
}
