const row=(value)=>Object.freeze({...value,effects:Object.freeze(value.effects),tags:Object.freeze(value.tags),cues:Object.freeze(value.cues??[])});
export const REVIEW_EFFECT_CATEGORIES=Object.freeze({attack:'攻撃',impact:'被弾',support:'支援',elemental:'属性',finisher:'大技',combo:'複合'});
export const REVIEW_EFFECT_CATALOG=Object.freeze([]);
export const reviewEffectRow=row;
