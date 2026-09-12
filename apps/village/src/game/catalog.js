/** Data-only catalog. Unlocks are based on first acquisition, not current balance. */
export const RESOURCE_NAMES={wood:'丸太',stone:'石',plank:'板材',clay:'粘土',food:'食料',seed:'種',herb:'薬草',ore:'鉄鉱石',metal:'鉄材',cloth:'布',leather:'革',medicine:'薬',knowledge:'知恵',crystal:'輝石',charm:'お守り',gear:'武具',furnishing:'家具材'};
export const MATERIALS={base:{label:'標準',color:0xe2cfa7},timber:{label:'木造',color:0xba926e},stone:{label:'石造',color:0xaeb8b3},earth:{label:'土壁',color:0xccaf89}};
const f=(id,label,w,d,extra={})=>({id,label,w,d,floors:1,roof:0x8f9b82,capacity:0,jobs:2,building:true,category:'仕事',cost:{},unlock:[],trait:'住人の暮らしを支える場所',...extra});
export const BUILDINGS=[
 f('mayor','村長のテント',10,12,{shape:'tent',roof:0xc29268,capacity:1,jobs:0,reserved:true,category:'非表示',trait:'あなたの分身が暮らす家。仕事、食事、団らんにも参加します。'}),
 f('campfire','焚き火',3.5,3.5,{shape:'fire',open:true,jobs:0,category:'非表示',trait:'村の集いの中心。食事、団らん、夜の語らいの場所です。'}),
 f('guardhome','専属護衛のテント',8,10,{shape:'tent',roof:0x698eaa,capacity:1,jobs:0,reserved:true,category:'非表示',trait:'専属護衛アルドの住まい。護衛は村長に同行し、近くの住人も守ります。'}),
 f('tent','空きテント',8,10,{shape:'tent',capacity:2,jobs:0,category:'住まい',roof:0x93a6a1,trait:'旅人2人の住まい。食事と守りに余裕があれば住み着きます。'}),
 f('storage','資材置き場',12,12,{shape:'yard',jobs:1,effect:'storage',trait:'共有倉庫。保管上限+300。増築ごとにさらに+300。'}),
 f('logging','伐採場',12,12,{shape:'yard',produce:{wood:5,seed:1},terrain:'forest',roof:0xa5a57e,trait:'近くの林から丸太と種を集めます。作業の動線が小径になります。'}),
 f('quarry','石切場',14,12,{shape:'yard',produce:{stone:4,ore:1},terrain:'rock',roof:0x9c9da1,trait:'露岩から石と鉄鉱石。2段階目から輝石も採れます。'}),
 f('carpenter','木工所',12,10,{shape:'tent',input:{wood:2},produce:{plank:4},unlock:['wood'],roof:0xb59b6f,trait:'丸太を板材へ加工。家や見張り台の建材になります。'}),
 f('wheat','小麦畑',14,14,{shape:'field',open:true,terrain:'fertile',produce:{food:6,seed:1},roof:0xccb16f,trait:'肥沃な土で小麦を育てます。食料と種、移住者を迎える余裕+4。'}),
 f('clay','泥採集場',12,10,{shape:'yard',terrain:'wetland',produce:{clay:4},roof:0xa78676,trait:'湿地や水辺の粘土を採集。土壁の家にも使えます。'}),
 f('market','市場',16,12,{shape:'market',effect:'market',produce:{cloth:1,herb:1},input:{food:1},roof:0xc49289,trait:'4日ごとに旅商人が2日間滞在。食料と交換で布・薬草を入手。住人は小物や家具を買います。'}),
 f('home','空き家',12,12,{capacity:3,jobs:0,category:'住まい',roof:0xbc7e62,unlock:['wood'],cost:{wood:12,plank:8,stone:6},variants:true,trait:'3人の家。建材を選べ、増築で定員と快適さが増します。'}),
 f('lodge','大きな空き家',16,18,{capacity:6,jobs:0,category:'住まい',floors:2,roof:0x77988a,unlock:['plank','stone'],cost:{wood:24,plank:16,stone:12},variants:true,trait:'6人の共同住宅。村の食料と警備に余裕をつくってから。'}),
 f('clanManor','一族の邸宅',28,26,{capacity:4,jobs:0,category:'住まい',floors:2,roof:0x858ab0,clanOnly:true,unlock:['plank','stone','cloth'],cost:{wood:28,plank:32,stone:24,cloth:8},variants:true,trait:'輪廻転焦の一族プレイヤー専用。一般NPCは自動入居しません。各人の家具と一族情報を保持します。'}),
 f('guardpost','詰所',10,10,{shape:'tent',category:'守り',roof:0x829ca5,jobs:1,unlock:['wood'],cost:{wood:8},effect:'guard',defense:5,trait:'住人1人が警備職に就きます。就労後は周辺を巡回し、移住者の安心枠+5。'}),
 f('watchtower','見張り台',8,8,{category:'守り',floors:2,jobs:1,roof:0x7d9196,unlock:['plank'],cost:{wood:12,plank:8},effect:'watch',defense:4,trait:'近隣30mの見張り。警備員の迎撃に加え、脅威の早期発見と安心枠+4。'}),
 f('barracks','駐屯所',18,18,{category:'守り',floors:2,jobs:3,cost:{wood:22,stone:25,plank:20},unlock:['plank','stone'],effect:'guard',defense:10,roof:0x8b8f9e,trait:'警備職3人の拠点。巡回と救助を行い、移住者の安心枠+10。'}),
 f('chapel','教会',16,22,{cost:{stone:30,plank:18,clay:12},unlock:['stone','clay','plank'],effect:'comfort',produce:{charm:1},input:{knowledge:1},roof:0xa59cbe,trait:'日々の安心を高め、学んだ知恵をお守りにします。'}),
 f('harbor','船着き場',18,18,{cost:{wood:30,plank:30,stone:15},unlock:['plank','stone'],effect:'harbor',terrain:'coast',roof:0x879bad,trait:'東海岸の港。5年ごとに巨大帆船が寄港し、布と薬草を届けて魔王軍戦線へ出港します。'}),
 f('smith','鍛冶屋',14,12,{cost:{stone:22,plank:12,clay:8},unlock:['ore','plank'],input:{ore:2,wood:1},produce:{metal:2},effect:'tools',roof:0xa57a63,trait:'鉄鉱石を鉄材へ。金属を使う武具や設備が利用可能になります。'}),
 f('dojo','道場',18,16,{category:'守り',cost:{wood:20,plank:20,stone:8},unlock:['plank'],effect:'training',produce:{knowledge:1},roof:0x927e72,trait:'心身を鍛え、村の護衛の攻撃力を底上げします。知恵も蓄えます。'}),
 f('school','学校',18,16,{cost:{wood:18,plank:20,clay:8},unlock:['plank','clay'],effect:'learning',produce:{knowledge:2},roof:0x9aaa7c,trait:'読み書きと仕事を学ぶ場所。知恵を生み、住人の技能が育ちます。'}),
 f('clinic','治療所',14,14,{cost:{wood:14,plank:14,stone:10},unlock:['herb','plank'],effect:'healing',input:{herb:1},produce:{medicine:2},roof:0x9aacbb,trait:'薬草から薬を作り、負傷者を救助・治療します。'}),
 f('farm','農園',18,20,{shape:'estate',terrain:'fertile',cost:{wood:16,stone:8,plank:10},unlock:['seed','plank'],produce:{food:14,herb:1},roof:0x9aab7b,trait:'豊かな土で食料と薬草を栽培。食事の余裕+8。'}),
 f('fishpond','釣り堀',16,16,{shape:'pond',open:true,terrain:'water',cost:{stone:20,wood:12,clay:12},unlock:['clay','stone'],produce:{food:10},roof:0x8daca5,trait:'水辺に作る釣り場。食料を得て、住人が釣りを楽しみます。'}),
 f('hunting','猟場',18,18,{shape:'yard',terrain:'forest',cost:{wood:14,stone:6,plank:8},unlock:['plank'],produce:{food:9,leather:2},roof:0x7a8976,trait:'森で食料と革を集めます。警備の届く位置なら野生動物からも安心。'}),
 f('orchard','果樹園',18,20,{shape:'orchard',open:true,terrain:'fertile',cost:{wood:14,stone:8,plank:6},unlock:['seed','plank'],produce:{food:12,herb:1},roof:0xa6b780,trait:'実りと薬草の庭。住人が実を摘み、木陰で休みます。'}),
 f('inn','宿屋',18,18,{floors:2,cost:{wood:24,stone:12,plank:22},unlock:['plank','cloth'],effect:'rest',roof:0xa57979,trait:'疲れを癒やす宿。休息の回復量が増え、村の魅力も高まります。'}),
 f('diner','食堂',14,14,{cost:{wood:14,plank:12,clay:8},unlock:['food','plank'],effect:'meal',roof:0xc3a174,trait:'住人が集まって食事。満腹度と気分の回復が増します。'}),
 f('restaurant','料亭',20,18,{cost:{wood:22,plank:28,stone:16,clay:10},unlock:['food','herb','cloth'],effect:'feast',roof:0x929e87,trait:'薬草と食料があれば、時折ごちそうの集いを開きます。'}),
 f('weapons','武器屋',14,12,{category:'守り',cost:{wood:12,metal:8,plank:14},unlock:['metal'],input:{metal:1,plank:1},produce:{gear:1},effect:'equipment',roof:0x9e8476,trait:'鉄と板材から武具を生産。備蓄した武具は護衛の強さに反映されます。'}),
 f('armor','防具屋',14,12,{category:'守り',cost:{wood:14,metal:6,plank:14},unlock:['metal','leather'],input:{leather:1,metal:1},produce:{gear:2},effect:'equipment',roof:0x7d94a0,trait:'革と鉄で防具を作り、警備職を支えます。'}),
 f('jeweler','装飾工房',12,12,{cost:{wood:12,stone:14,plank:18,metal:4},unlock:['crystal','metal'],input:{crystal:1},produce:{charm:2},effect:'craft',roof:0xb093b0,trait:'輝石をお守りへ。装飾と魔除けの灯りに使えます。'}),
 f('tools','道具屋',12,12,{cost:{wood:14,plank:12,stone:8},unlock:['metal'],input:{wood:1,metal:1},produce:{gear:1},effect:'tools',roof:0xb09f76,trait:'道具の手入れと製作。採集・生産の効率を上げます。'}),
 f('tavern','酒場',16,14,{cost:{wood:20,plank:16,clay:10},unlock:['food','plank','clay'],effect:'comfort',roof:0xa88183,trait:'夕方には語らいと音楽。住人同士の親しさが育ちます。'}),
 f('furniture','家具屋',16,14,{cost:{wood:18,plank:22,stone:6},unlock:['plank','cloth'],input:{plank:2},produce:{furnishing:2},effect:'furniture',roof:0x8e9daa,trait:'板から家具材を作ります。住人が部屋を飾る楽しみを支えます。'})
];
// The same acquired masonry modules support material choices for enclosed facilities.
for(const d of BUILDINGS)if(d.category!=='非表示'&&d.id!=='harbor'&&(!d.shape||d.shape==='estate'))d.variants=true;
export const GARDEN=[
 {id:'fence',label:'柵',w:4,d:.55,unlock:['wood'],cost:{wood:1},defense:.22},
 {id:'wall',label:'塀',w:4,d:.85,unlock:['stone'],cost:{stone:2},defense:.45},
 {id:'tree',label:'植林・広葉樹',w:3,d:3,unlock:['seed'],cost:{seed:1}},
 {id:'pine',label:'植林・針葉樹',w:3,d:3,unlock:['seed'],cost:{seed:1}},
 {id:'flowers',label:'花',w:2.5,d:2.5,soft:true,unlock:['seed'],cost:{seed:1}},
 {id:'hedge',label:'生垣',w:4,d:1.1,unlock:['seed'],cost:{seed:2},defense:.12},
 {id:'lamp',label:'街灯',w:.9,d:.9,unlock:['wood'],cost:{wood:1},defense:.25},
 {id:'bench',label:'ベンチ',w:2.8,d:1.3,unlock:['plank'],cost:{plank:2}},
 {id:'wardlamp',label:'魔除けの灯り',w:1.2,d:1.2,unlock:['charm'],cost:{stone:3,charm:2},defense:2}
].map(o=>({...o,category:'庭',garden:true}));
export const FURNITURE=[
 {id:'bed',label:'ベッド',w:2.1,d:3.4},{id:'sofa',label:'ソファ',w:3.4,d:1.7},
 {id:'table',label:'食卓',w:2.8,d:2},{id:'chair',label:'椅子',w:1,d:1},
 {id:'shelf',label:'本棚',w:2.6,d:.9},{id:'counter',label:'カウンター',w:3.5,d:1.3},
 {id:'workbench',label:'作業台',w:3,d:1.7},{id:'hearth',label:'暖炉',w:2.5,d:1.2},
 {id:'rug',label:'絨毯',w:4.4,d:3.2,soft:true},{id:'plant',label:'鉢植え',w:1,d:1},
 {id:'lamp',label:'灯り',w:.9,d:.9},{id:'bench',label:'ベンチ',w:2.8,d:1.3}
].map(o=>({...o,category:'家具',furniture:true}));
export const defs={};for(const o of [...GARDEN,...FURNITURE,...BUILDINGS])defs[o.id]={...defs[o.id],...o};
// Keep garden costs/unlocks even where the room catalog shares an asset id.
export function unlocked(state,kind,room=false){if(room)return FURNITURE.some(d=>d.id===kind);const d=defs[kind];return !!d&&d.category!=='非表示'&&(d.unlock||[]).every(k=>state.known.includes(k));}
export function recipe(kind,variant='base'){
 const d=defs[kind];if(!d)return {};
 if(!d.variants||variant==='base')return {...d.cost};
 const structural=['wood','plank','stone','clay'],units=structural.reduce((n,k)=>n+(d.cost[k]||0),0),scale=kind==='home'?1:kind==='lodge'?1.8:kind==='clanManor'?2.8:Math.max(.65,units/26),special=Object.fromEntries(Object.entries(d.cost).filter(([k])=>!structural.includes(k)));
 if(variant==='timber')return {...special,wood:Math.ceil(20*scale),plank:Math.ceil(8*scale)};
 if(variant==='stone')return {...special,stone:Math.ceil(23*scale),wood:Math.ceil(5*scale)};
 if(variant==='earth')return {...special,clay:Math.ceil(21*scale),wood:Math.ceil(7*scale)};
 return {...d.cost};
}
export function materialOptions(state,kind){const d=defs[kind];const variants=d?.variants?['base','timber','stone','earth']:['base'];return variants.filter(v=>v==='base'||Object.keys(recipe(kind,v)).every(k=>state.known.includes(k))).map(id=>({id,...MATERIALS[id],cost:recipe(kind,id),affordable:Object.entries(recipe(kind,id)).every(([k,n])=>state.stock[k]>=n)}));}
export const capacityOf=o=>(defs[o.kind].capacity||0)+(defs[o.kind].capacity&&!defs[o.kind].reserved?Math.max(0,(o.level||1)-1)*(defs[o.kind].clanOnly?2:1):0);
export const jobsOf=o=>(defs[o.kind].jobs||0)+(defs[o.kind].jobs?Math.max(0,(o.level||1)-1):0);
export const TUTORIAL=[
 {kind:'tent',title:'空きテントをひとつ',text:'旅人の住まいを用意しましょう。護衛の家とは別に置きます。',at:[-22,12]},
 {kind:'logging',title:'林のそばに伐採場',text:'丸太が届くと、木工所や詰所が利用可能になります。',at:[-32,-25]},
 {kind:'wheat',title:'豊かな土に小麦畑',text:'育った小麦は、住人たちの食事になります。',at:[-10,-39]},
 {kind:'carpenter',title:'丸太を板材に',text:'木工所を置くと、建てられるものが少しずつ増えます。',at:[14,-30]},
 {kind:'guardpost',title:'詰所で守りを広げる',text:'警備職がつくと、新しい住人を安心して迎えられます。',at:[-8,23]}
];
