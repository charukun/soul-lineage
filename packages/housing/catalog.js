// Portable, renderer-independent content. Dimensions are world metres, Y-up.
export const PALETTES = [
 {name:'苺の屋根', roof:'#ab5963',wall:'#efdec5'},
 {name:'青い夜',roof:'#567f96',wall:'#e9e0c9'},
 {name:'若葉',roof:'#658470',wall:'#eee4d0'},
 {name:'蜂蜜',roof:'#c18b52',wall:'#f2dfb9'},
 {name:'菫',roof:'#82749c',wall:'#e9d9d2'},
 {name:'雪灯り',roof:'#afbec0',wall:'#f7e9d1'}
];
export const CATEGORIES=[
 {id:'homes',label:'家をつくる',icon:'home'},
 {id:'village',label:'村の暮らし',icon:'village'},
 {id:'nature',label:'庭と緑',icon:'leaf'},
 {id:'ground',label:'道と地形',icon:'path'},
 {id:'magic',label:'不思議なもの',icon:'spark'},
 {id:'furniture',label:'家具を飾る',icon:'chair'}
];
const item=(id,name,cat,w,d,extra={})=>({id,name,cat,w,d,kind:id,beauty:1,...extra});
export const CATALOG=[
 item('cottage','木漏れ日の家','homes',2.8,2.7,{house:true,beauty:5,desc:'花窓と煙突のある小さな家。屋根や階数も自由に。'}),
 item('tallhouse','星見の家','homes',2.5,2.5,{house:true,beauty:6,desc:'空を近くに感じる、背の高い家。'}),
 item('roundhouse','森のまるい家','homes',2.8,2.8,{house:true,beauty:6,desc:'とんがり屋根と丸窓。森の住民に似合う住まい。'}),
 item('mushroom','きのこの家','homes',3,3,{house:true,beauty:7,desc:'雨の日にも心地いい、ふっくらした傘の家。'}),
 item('manor','白樺の館','homes',4.2,3,{house:true,beauty:9,desc:'二つの屋根と大きなポーチ。家の中も広々。'}),
 item('greenhouse','硝子の温室','homes',3,2.8,{house:true,beauty:7,desc:'光があふれる植物の家。家具を置いて秘密の書斎にも。'}),
 item('windmill','風待ちの風車','village',2.8,2.8,{beauty:7,desc:'羽根がゆっくり回り、村の時間を刻みます。'}),
 item('bakery','こむぎのパン屋','village',2.8,2.5,{beauty:6,desc:'しましまのひさしと、焼きたてのパン。'}),
 item('market','花と果実の市','village',2.5,1.8,{beauty:4}),
 item('fountain','月の泉','village',2.3,2.3,{beauty:5}),
 item('well','願いの井戸','village',1.5,1.5,{beauty:3}),
 item('bench','ひとやすみの椅子','village',1.6,.65,{beauty:2}),
 item('lamp','真鍮の街灯','village',.4,.4,{beauty:2,overlap:true}),
 item('bridge','小さな太鼓橋','village',2.8,1.8,{beauty:4,bridge:true}),
 item('tree','丸葉の木','nature',1.4,1.4,{beauty:2}),
 item('blossom','花霞の桜','nature',1.8,1.8,{beauty:4}),
 item('pine','銀葉のもみの木','nature',1.3,1.3,{beauty:2}),
 item('flower','花の小径','nature',.9,.9,{beauty:2,brush:true,overlap:true}),
 item('garden','小さな菜園','nature',1.7,1.7,{beauty:3}),
 item('hedge','まるい生け垣','nature',1.3,.55,{beauty:1,brush:true}),
 item('rock','苔むした岩','nature',1,1,{beauty:1}),
 item('pond','睡蓮の池','nature',2.4,2.4,{beauty:4}),
 item('path','白い石畳','ground',.85,.85,{beauty:0,brush:true,overlap:true}),
 item('woodpath','木の散歩道','ground',.85,.85,{beauty:0,brush:true,overlap:true}),
 item('fence','白木の柵','ground',1,.2,{beauty:0,brush:true,overlap:true}),
 item('raise','丘を盛る','ground',2,2,{terrain:true}),
 item('lower','丘をならす','ground',2,2,{terrain:true}),
 item('erase','しまう','ground',1,1,{erase:true}),
 item('crystal','星の結晶','magic',.8,.8,{beauty:3}),
 item('portal','月環の門','magic',2.3,.8,{beauty:7}),
 item('lantern','空に浮かぶ灯','magic',.4,.4,{beauty:2,overlap:true}),
 item('gazebo','妖精の東屋','magic',3,3,{beauty:6}),
 item('arch','花のアーチ','magic',2.3,.65,{beauty:4}),
 item('telescope','星読みの望遠鏡','magic',1.2,1.2,{beauty:4}),
 item('bed','雲のベッド','furniture',1.7,2.2,{indoor:true,beauty:3}),
 item('sofa','森色のソファ','furniture',2,.9,{indoor:true,beauty:3}),
 item('table','丸いお茶の卓','furniture',1.3,1.3,{indoor:true,beauty:2}),
 item('chair','小さな木の椅子','furniture',.65,.65,{indoor:true,beauty:1}),
 item('shelf','物語の本棚','furniture',1.7,.55,{indoor:true,beauty:3}),
 item('rug','星織りの絨毯','furniture',2.6,1.8,{indoor:true,beauty:2,overlap:true}),
 item('stove','こもれびの暖炉','furniture',1.4,.8,{indoor:true,beauty:3}),
 item('pot','窓辺の鉢植え','furniture',.55,.55,{indoor:true,beauty:1}),
 item('cabinet','琥珀のチェスト','furniture',1.4,.6,{indoor:true,beauty:2}),
 item('cushion','花びらのクッション','furniture',.75,.75,{indoor:true,beauty:1}),
 item('piano','小さなピアノ','furniture',1.8,.95,{indoor:true,beauty:4}),
 item('floorlamp','読書の灯','furniture',.45,.45,{indoor:true,beauty:2})
];
export const ITEMS=Object.fromEntries(CATALOG.map(x=>[x.id,x]));
export const ISLANDS=[
 {id:0,x:0,z:0,r:15,name:'はじまりの庭',cost:0},
 {id:1,x:23,z:-6,r:7,name:'星見の丘',cost:25},
 {id:2,x:-22,z:-8,r:6,name:'花霞の森',cost:35},
 {id:3,x:1,z:-25,r:6.5,name:'月の書庫',cost:45}
];
export const RESIDENTS=[
 {name:'ミリ',role:'花を育てる人',color:'#bd7f83',line:'道のそばに花があると、少し遠回りしたくなるね。'},
 {name:'ノア',role:'パンを焼く人',color:'#67988a',line:'朝の匂いがする村にしたいんだ。'},
 {name:'ソラ',role:'星を読む人',color:'#848eb5',line:'あの浮島にも、いつか灯りをともそう。'},
 {name:'ルゥ',role:'物語を集める人',color:'#bba56c',line:'家の中に、君だけの物語を飾ってね。'},
 {name:'フィン',role:'森の旅人',color:'#708a72',line:'世界が広くても、帰りたい場所はひとつでいい。'},
 {name:'ネリ',role:'風の仕立て屋',color:'#9b85b1',line:'屋根の色が変わるだけで、村の気分も変わるね。'}
];
