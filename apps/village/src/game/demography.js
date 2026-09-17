export const DEMOGRAPHY_HISTORY_LIMIT=120;

const whole=value=>Math.max(0,Math.floor(Number(value)||0));
const fraction=value=>Math.max(0,Math.min(.999999,Number(value)||0));
const transfer=(count,rate,carry)=>{
 const total=whole(count)*rate+fraction(carry),moved=Math.min(whole(count),Math.floor(total));
 return{moved,carry:total-moved};
};

export function normalizeVirtualCohorts(raw={},fallbackAdults=0){
 const legacy=!Object.hasOwn(raw||{},'child')&&!Object.hasOwn(raw||{},'youth'),elder=whole(raw?.elder),rawAdult=whole(raw?.adult),fallback=whole(fallbackAdults),adult=legacy?rawAdult+Math.max(0,fallback-rawAdult-elder):rawAdult;
 return{
  child:whole(raw?.child),
  youth:whole(raw?.youth),
  adult,
  elder,
  carry:{
   childToYouth:fraction(raw?.carry?.childToYouth),
   youthToAdult:fraction(raw?.carry?.youthToAdult),
   adultToElder:fraction(raw?.carry?.adultToElder),
   elderDeaths:fraction(raw?.carry?.elderDeaths)
  }
 };
}

/** Advance coarse LOD residents by one village year without needing per-person objects. */
export function advanceVirtualCohorts(raw){
 const before=normalizeVirtualCohorts(raw),child=transfer(before.child,1/13,before.carry.childToYouth),youth=transfer(before.youth,1/5,before.carry.youthToAdult),adult=transfer(before.adult,1/42,before.carry.adultToElder),elder=transfer(before.elder,1/14,before.carry.elderDeaths);
 const cohorts={
  child:before.child-child.moved,
  youth:before.youth+child.moved-youth.moved,
  adult:before.adult+youth.moved-adult.moved,
  elder:before.elder+adult.moved-elder.moved,
  carry:{childToYouth:child.carry,youthToAdult:youth.carry,adultToElder:adult.carry,elderDeaths:elder.carry}
 };
 return{cohorts,deaths:elder.moved};
}

/**
 * Yearly population pressure. Births need adult households plus infrastructure headroom.
 * A village above its food/safety limit, or with an empty food store, loses residents.
 */
export function planDemographicYear(input={}){
 const population=whole(input.population),limit=whole(input.limit),openBeds=whole(input.openBeds),eligibleAdults=whole(input.eligibleAdults),comfort=Math.max(0,Number(input.comfort)||0),foodStock=Math.max(0,Number(input.foodStock)||0),protectedResidents=Math.min(population,whole(input.protectedResidents??2));
 const infrastructureVacancy=Math.max(0,limit-population),housingVacancy=Math.max(0,openBeds-population),headroom=Math.min(infrastructureVacancy,housingVacancy),pairs=Math.floor(eligibleAdults/2);
 const foodPerPerson=foodStock/Math.max(1,population),foodFactor=foodStock<=0?0:Math.min(1.08,.72+Math.min(1,foodPerPerson/2)*.36),comfortFactor=Math.min(1.22,.9+comfort*.025);
 const expectedBirths=pairs*.34*foodFactor*comfortFactor,birthPool=fraction(input.birthCarry)+expectedBirths,birthCap=Math.max(1,Math.ceil(Math.max(1,population)*.06)),births=Math.min(headroom,birthCap,Math.floor(birthPool));
 const birthCarry=Math.min(.999999,Math.max(0,birthPool-births));
 const overLimit=Math.max(0,population-limit),starvation=foodStock<=0?Math.ceil(population*.05):foodStock<Math.max(2,population*.15)?Math.ceil(population*.02):0,departures=Math.min(Math.max(0,population-protectedResidents),Math.max(overLimit,starvation));
 return{births,departures,birthCarry,headroom,pairs};
}

export function recordDemographyHistory(history,snapshot,limit=DEMOGRAPHY_HISTORY_LIMIT){
 const list=Array.isArray(history)?history.filter(item=>item&&Number.isFinite(Number(item.year))).map(item=>({...item})):[],entry={year:whole(snapshot?.year),population:whole(snapshot?.population),births:whole(snapshot?.births),deaths:whole(snapshot?.deaths),departures:whole(snapshot?.departures),children:whole(snapshot?.children),youth:whole(snapshot?.youth),adults:whole(snapshot?.adults),elders:whole(snapshot?.elders)};
 const existing=list.findIndex(item=>whole(item.year)===entry.year);
 if(existing>=0)list[existing]=entry;else list.push(entry);
 list.sort((a,b)=>a.year-b.year);
 return list.slice(-Math.max(2,whole(limit)||DEMOGRAPHY_HISTORY_LIMIT));
}
