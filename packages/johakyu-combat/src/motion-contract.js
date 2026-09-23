/** Semantic motion/contact vocabulary. Asset bindings live in johakyu-presentation. */
const defense=new Set(['guard','brace','parry','ready','retreat','slip']);
const armed=new Set(['slash','back','thrust','pierce','heavy','diagonal','sweep','counter','dash','crosscut','round','bash','pommel']);
const unarmed=new Set(['jab','straight','hook','bodyblow','counter','bash','pommel']);
const weapons=new Set(['fist','sword','dagger','great','spear','axe','staff']);
const phases=new Set(['jo','ha','kyu','uke','one','finisher','enemy']);
export function resolveJohakyuMotion({weapon,kind,phase='jo',charge='none'}={}){
 if(!weapons.has(weapon))return Object.freeze({supported:false,reason:'weapon',weapon,kind});
 if(!phases.has(phase)||!['none','breath','deep','focus'].includes(charge))return Object.freeze({supported:false,reason:'phase-or-charge',weapon,kind});
 if(!defense.has(kind)&&!(weapon==='fist'?unarmed:armed).has(kind))return Object.freeze({supported:false,reason:'unbound-action',weapon,kind});
 const two=['great','spear','axe','staff'].includes(weapon),thrust=['thrust','pierce','counter','dash'].includes(kind),horizontal=['back','sweep','crosscut','round'].includes(kind);
 const contactProgress=kind==='parry'?.43:['guard','brace'].includes(kind)?.46:kind==='bash'||kind==='pommel'?.48:defense.has(kind)||weapon==='fist'?.5:thrust?(two?.57:.56):kind==='heavy'?(two?.57:.55):two?.52:horizontal?.5:.51;
 const bladeTrajectory=kind==='parry'?'parry-out':defense.has(kind)?'guard':kind==='bash'||kind==='pommel'?'short-forward':weapon==='fist'?'forward':thrust?'forward':kind==='heavy'?'top-down':horizontal&&!two?'left-to-right':'right-to-left';
 return Object.freeze({supported:true,weapon,kind,phase,charge,offense:!defense.has(kind),contactProgress,bladeTrajectory,deflect:['forward','short-forward','left-to-right'].includes(bladeTrajectory)?'right':defense.has(kind)?null:'left',clock:'canonical-attack-progress'});
}
