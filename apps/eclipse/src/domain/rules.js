/** Deterministic combat rules. Rendering and browser APIs do not belong here. */
export const WAVES = [
  { title:'灰からの帰還', subtitle:'THE RESTLESS DEAD', count:9, hp:46, attack:7, interval:.9, mage:0 },
  { title:'ささやく亡霊', subtitle:'WHISPERS IN THE DARK', count:13, hp:64, attack:9, interval:.72, mage:4 },
  { title:'凍てつく祈り', subtitle:'A PRAYER IN FROST', count:17, hp:86, attack:11, interval:.67, mage:4 },
  { title:'夜は、なお深く', subtitle:'BEFORE THE DAWN', count:21, hp:105, attack:13, interval:.62, mage:4 },
  { title:'朽ちた王、ヴァルグ', subtitle:'THE LAST SOVEREIGN', count:13, hp:108, attack:14, interval:.85, mage:5, boss:true },
];
export const SKILLS = [
  { name:'旋刃', cooldown:5.2, radius:4.1, damage:48, animation:'2H_Melee_Attack_Spin', duration:.95 },
  { name:'霜環', cooldown:9.5, radius:5.7, damage:37, animation:'Spellcast_Raise', duration:1.15 },
  { name:'天墜', cooldown:17, radius:6.8, damage:125, animation:'Jump_Full_Short', duration:1.35 },
];
export const BLESSINGS = [
  { id:'edge', icon:'✧', title:'黎明の刃', detail:'すべての与ダメージ +25%', label:'ATTACK', apply:s => {s.damage *= 1.25;} },
  { id:'blood', icon:'❖', title:'不滅の灯', detail:'最大体力 +90・全回復', label:'VITALITY', apply:s => {s.maxHp += 90;s.hp=s.maxHp;} },
  { id:'flow', icon:'⟡', title:'刻の奔流', detail:'スキルの待機時間 −20%', label:'HASTE', apply:s => {s.cooldown *= .8;} },
];
export function seededRandom(seed=4831) { let n = seed|0; return () => {n |= 0;n = n + 0x6D2B79F5 | 0;let t=Math.imul(n ^ n>>>15,1|n);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;}; }
export const clamp = (x,min,max) => Math.max(min,Math.min(max,x));
export const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export const roman = n => ['I','II','III','IV','V'][n-1] ?? String(n);
export const clock = t => `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
export function freshStats() { return {hp:300,maxHp:300,damage:1,cooldown:1,blessings:[],kills:0,time:0,wave:1}; }
export function waveEnemies(wave) { const w=WAVES[wave-1];if(!w)throw new RangeError('Invalid wave');return Array.from({length:w.count},(_,i)=>w.boss&&i===0?'boss':w.mage&&i%w.mage===w.mage-1?'mage':i%3===0?'warrior':'minion'); }
export function chooseAutoBlessing(stats) { return stats.hp < stats.maxHp*.45 ? 'blood' : stats.wave%2 ? 'edge' : 'flow'; }
