import {ITEMS} from '@soul/housing-assets/catalog';
export const PREY={
 traveller:{name:'旅人',power:'命の余熱',glyph:'雫',desc:'捕食時の回復が増える。喰らった息が次の狩りを支える。',hp:38,weapon:'fist',color:0x8c7763},
 bellkeeper:{name:'鐘番',power:'声喰い',glyph:'黙',desc:'気配と悲鳴を抑え、村の警戒が上がりにくくなる。',hp:52,weapon:'fist',color:0xa99b76},
 smith:{name:'鍛冶師',power:'鉄砕く腕',glyph:'腕',desc:'最大生命が増え、前進し続けると木の封鎖を壊せる。',hp:82,weapon:'axe',color:0xa76542},
 hunter:{name:'猟師',power:'血の嗅覚',glyph:'眼',desc:'嗅覚が常時働く。家の向こうの獲物も見失わない。',hp:64,weapon:'spear',color:0x567f67},
 gravekeeper:{name:'墓守',power:'墓道の記憶',glyph:'径',desc:'礼拝所の裏に帰還口を開く。奥で喰らって裏から帰る。',hp:62,weapon:'fist',color:0x797287},
 acolyte:{name:'祈祷師',power:'祈りの残滓',glyph:'祈',desc:'聖域の結界を弱め、そこに逃げた獲物へ踏み込める。',hp:76,weapon:'sword',color:0xb0a785},
 arcanist:{name:'術師',power:'影渡り',glyph:'影',desc:'素早いスワイプで影を跳ぶ。壁の向こうへは移動しない。',hp:110,weapon:'sword',color:0x757a9c},
 knight:{name:'守護騎士',power:'刃骨',glyph:'骨',desc:'爪を骨刃へ変える。輪廻転焦の刀の技で戦う。',hp:145,weapon:'katana',color:0xabbcc4}
};
export const FORMS={hollow:{name:'虚ろ仔',desc:'狩りを覚えたばかりの異形。',need:0},stalker:{name:'夜這い',desc:'足が伸び、移動と追跡に優れる。',need:2},brute:{name:'骸喰い',desc:'骨の鎧をまとう。生命と重い爪に優れる。',need:4},wraith:{name:'喪の翼',desc:'裂けた翼を持つ、影を渡る異形。',need:6}};
export function random(seed){let a=seed|0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
const namesA=['霧鐘','黒楡','白骸','灰雨','夜葦','落月','哭石','薄灯','赤沼','骨霜','錆羽','葬花'];
const namesB=['の里','の谷','の宿場','の門前','の集落','の渡し'];
export function offerVillages(store){let offers;store.change(p=>{if(p.offers.length){offers=p.offers;return;}offers=[];const unlearned=Object.keys(PREY).filter(k=>!p.unlocked.includes(k));for(let i=0;i<3;i++){const n=++p.sequence,seed=hash(p.id+':'+n),r=random(seed),target=unlearned[(n-1)%Math.max(1,unlearned.length)]||Object.keys(PREY)[n%8];offers.push({id:`demo:${p.id}:${n}`,seed,name:namesA[Math.floor(r()*namesA.length)]+namesB[Math.floor(r()*namesB.length)]+`・${String(n).padStart(3,'0')}`,target,level:Math.min(4,1+Math.floor(p.unlocked.length/2)),weather:i===1?'rain':'fog',source:'generated',serial:n});}p.offers=offers;});return offers;}
export function makeVillage(v){const r=random(v.seed||hash(v.id)),entities=[],colliders=[],npcs=[],width=23,depth=31;
 function place(type,x,z,scale=1,rn=0,more={}){const it=ITEMS[type];const e={id:'e'+entities.length,type,x,z,r:rn,scale,palette:1,floors:1,...more};entities.push(e);if(it&&!it.overlap&&!['path','garden','pond','flower'].includes(type)){colliders.push({x,z,r:Math.max(it.w,it.d)*scale*.39,type,entityId:e.id});}return e;}
 if(v.entities){for(const e of v.entities){if(e.room>0||!ITEMS[e.type])continue;place(e.type,e.x,e.z,1,e.r||0,e);}}
 else{const shift=(r()-.5)*2;for(let side of [-1,1])for(let i=0;i<5;i++){const z=-21+i*9+(r()-.5)*3,x=side*(6.1+r()*1.4)+shift;place(['cottage','tallhouse','manor','bakery'][Math.floor(r()*4)],x,z,1.35+r()*.3,side<0?Math.PI/2:-Math.PI/2,{floors:i===0?2:1});}
 place('well',-5,-3,1.4);place('market',6,6,1.4,.2);place('fountain',5,-18,1.4);}
 const ext=v.entities?Math.max(27,...v.entities.map(e=>Math.abs(e.x)+4),...v.entities.map(e=>Math.abs(e.z)+6)):31;
 const bell={x:0,z:-17},chapel={x:0,z:-23};
 const entry={x:0,z:v.entities?ext-3:20};
 let positions=[[1,entry.z-5],[-3,entry.z-12],[3,7],[-4,-3],[5,-10],[-2,-16],[0,-23],[8,-22],[-9,13],[8,17],[-13,-6],[12,-14]];
 const trade=r()<.5?'smith':'hunter';const keys=['traveller','bellkeeper',trade,'traveller','bellkeeper','traveller',v.target,trade,'traveller','traveller',trade,'bellkeeper'];
 function blocked(x,z){return colliders.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+.6);}
 for(let i=0;i<positions.length;i++){let [x,z]=positions[i];for(let tries=0;blocked(x,z)&&tries<50;tries++){x=(r()-.5)*35;z=(r()-.5)*40;}
 const role=i===6?v.target:keys[i],d=PREY[role];if(i===6){x=-3;z=role==='traveller'?10:['arcanist','acolyte'].includes(role)?-18:-12;}
 const names=['イェル','ルッツ','サラ','エッダ','グラム','ノア','ヴェラ','クルト'];npcs.push({id:`${v.id}:human:${i}`,kind:'human',adult:true,role,name:i===6?d.name+' '+names[Math.floor(r()*names.length)]:d.name,x,z,homeX:x,homeZ:z,yaw:r()*6.28,hp:d.hp+(i===6?18:0),maxhp:d.hp+(i===6?18:0),state:'idle',clock:r()*5,walk:0,marked:i===6,dead:false,eaten:false,fear:0});}
 if(v.source!=='imported-local')colliders.push({x:0,z:-26,r:3.2,type:'chapel'});
 return{...v,entities,colliders,npcs,entry,bell,chapel,bounds:ext,gate:{x:0,z:1.5,r:2.05,broken:false},shelter:{x:0,z:-23,r:3.1}};
}
export function importHousing(data){if(!data||data.gameId!=='village'||!data.payload||!Array.isArray(data.payload.entities))throw Error('ハウジングの村セーブJSONを選んでください。');
 const owner=data.ownerId||data.playerId;if(typeof owner!=='string'||!owner.trim())throw Error('所有者IDのない村は読み込めません。');
 const canonical=data.villageId??data.payload.villageId;if(canonical!==undefined&&(typeof canonical!=='string'||!canonical.trim()||canonical.length>180))throw Error('村IDが不正です。');const id=canonical?'housing:'+canonical:'legacy-housing:'+owner+':primary';
 if(id.length>200||data.payload.entities.length>1000)throw Error('村のデータが大きすぎるか、識別子が不正です。');
 const seen=new Set();const entities=data.payload.entities.map(e=>{if(!e||!Object.hasOwn(ITEMS,e.type)||![e.x,e.z].every(Number.isFinite)||Math.abs(e.x)>100||Math.abs(e.z)>100||e.r!==undefined&&!Number.isFinite(e.r))throw Error('対応していない村オブジェクトが含まれています。');if((typeof e.id!=='string'&&typeof e.id!=='number')||!String(e.id)||seen.has(String(e.id)))throw Error('村オブジェクトIDが重複、または不正です。');seen.add(String(e.id));if(e.room!==undefined&&(!Number.isInteger(e.room)||e.room<0))throw Error('部屋IDが不正です。');return{id:String(e.id),type:e.type,x:e.x,z:e.z,r:e.r||0,palette:Math.min(5,Math.max(0,e.palette|0)),floors:Math.min(3,Math.max(1,e.floors|0)),room:e.room|0};});
 return{id,ownerId:owner,name:String(data.payload.name||'読み込んだ村').slice(0,60),seed:hash(id),entities,target:'arcanist',source:'imported-local',level:2,weather:'fog',revision:data.revision||0,legacyIdentity:!canonical};
}
