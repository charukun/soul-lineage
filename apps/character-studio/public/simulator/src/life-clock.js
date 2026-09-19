/** Platform-independent life clock. Combat simulation has its own unchanged clock. */
export const LIFE_RULES = Object.freeze({version:1,secondsPerYear:60,lifespanYears:90,startAgeYears:0,maxRate:20});
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const finite=(n,f)=>typeof n==='number'&&Number.isFinite(n)?n:f;
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a),0,1);return t*t*(3-2*t);};
const bodyKeys=[[0,.40],[3,.49],[7,.64],[12,.80],[18,.98],[22,1],[50,1],[65,.985],[80,.955],[90,.935]];
export function appearanceForAge(years){
 const age=clamp(finite(years,0),0,90);let scale=bodyKeys.at(-1)[1];
 for(let i=1;i<bodyKeys.length;i++){if(age<=bodyKeys[i][0]){const a=bodyKeys[i-1],b=bodyKeys[i],t=smooth(a[0],b[0],age);scale=a[1]+(b[1]-a[1])*t;break;}}
 return {age,scale,headScale:1+.22*(1-smooth(0,18,age)),gray:smooth(42,82,age),stoop:.25*smooth(55,90,age),skinAge:smooth(50,90,age),stage:age<3?'乳幼児期':age<13?'幼少期':age<20?'少年期':age<40?'青年期':age<60?'壮年期':age<75?'老年期':'晩年'};
}
export class LifeClock{
 constructor(saved=null){const v=saved?.version===1?saved:{};this.ageSeconds=clamp(finite(v.ageSeconds,0),0,5400);this.worldSeconds=Math.max(this.ageSeconds,finite(v.worldSeconds,this.ageSeconds));this.rate=clamp(Math.round(finite(v.rate,1)),1,20);this.enemiesEnabled=typeof v.enemiesEnabled==='boolean'?v.enemiesEnabled:true;this.lives=clamp(Math.floor(finite(v.lives,1)),1,1e9);}
 get ageYears(){return this.ageSeconds/60;}
 get age(){return Math.floor((this.ageSeconds+1e-8)/60);}
 get expired(){return this.ageSeconds>=5400-1e-8;}
 setRate(rate){if(typeof rate!=='number'||!Number.isFinite(rate))throw new TypeError('世界速度は数値で指定してください');this.rate=clamp(Math.round(rate),1,20);return this.rate;}
 setEnemies(enabled){if(typeof enabled!=='boolean')throw new TypeError('敵の出現はON/OFFで指定してください');this.enemiesEnabled=enabled;}
 advance(realSeconds){if(!Number.isFinite(realSeconds)||realSeconds<0)throw new RangeError('経過秒が不正です');if(this.expired||realSeconds===0)return {birthdays:0,died:false};const age=this.age,delta=Math.min(5400-this.ageSeconds,realSeconds*this.rate);this.ageSeconds+=delta;this.worldSeconds+=delta;if(this.ageSeconds>=5400-1e-8)this.ageSeconds=5400;return {birthdays:this.age-age,died:this.expired};}
 rebirth(){this.ageSeconds=0;this.lives++;}
 snapshot(){return {...this.toJSON(),age:this.age,ageYears:this.ageYears,expired:this.expired,appearance:appearanceForAge(this.ageYears),secondsToBirthday:this.expired?0:(60-(this.ageSeconds%60))/this.rate,secondsToDeath:Math.max(0,5400-this.ageSeconds)/this.rate};}
 toJSON(){return {version:1,ageSeconds:this.ageSeconds,worldSeconds:this.worldSeconds,rate:this.rate,enemiesEnabled:this.enemiesEnabled,lives:this.lives};}
}
