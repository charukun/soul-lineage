const RAW='https://raw.githubusercontent.com/charukun/soul-lineage/develop/';
const npc=name=>`docs/characters/references/npc-role-set/${name}.avif`;
const freezePalette=value=>Object.freeze(Object.fromEntries(Object.entries(value).map(([key,row])=>[key,Object.freeze(row)])));
const PALETTE=Object.freeze({
  shino:freezePalette({skin:[.96,.80,.72],hair:[.62,.39,.27],eyes:[.36,.23,.16],primary:[.20,.32,.16],secondary:[.83,.78,.68],accent:[.64,.49,.25],dark:[.16,.12,.10],metal:[.55,.55,.50],leather:[.29,.18,.12],wood:[.32,.20,.11]}),
  villageBoy:freezePalette({skin:[.88,.69,.58],hair:[.30,.20,.14],eyes:[.30,.24,.18],primary:[.34,.39,.28],secondary:[.67,.58,.45],accent:[.48,.35,.22],dark:[.15,.13,.11],metal:[.48,.50,.48],leather:[.28,.19,.13],wood:[.34,.23,.13]}),
  villageGirl:freezePalette({skin:[.94,.76,.67],hair:[.48,.30,.20],eyes:[.30,.38,.30],primary:[.38,.46,.34],secondary:[.78,.69,.57],accent:[.62,.42,.34],dark:[.16,.13,.11],metal:[.52,.53,.50],leather:[.31,.21,.14],wood:[.36,.24,.14]}),
  elderMan:freezePalette({skin:[.76,.61,.53],hair:[.62,.62,.58],eyes:[.28,.25,.22],primary:[.34,.31,.27],secondary:[.54,.50,.42],accent:[.42,.35,.26],dark:[.14,.13,.12],metal:[.46,.47,.45],leather:[.27,.20,.15],wood:[.31,.24,.17]}),
  elderWoman:freezePalette({skin:[.80,.64,.56],hair:[.70,.68,.63],eyes:[.30,.27,.24],primary:[.42,.36,.36],secondary:[.62,.55,.48],accent:[.52,.43,.35],dark:[.16,.14,.13],metal:[.47,.48,.45],leather:[.29,.22,.17],wood:[.34,.25,.17]}),
  guard:freezePalette({skin:[.84,.66,.55],hair:[.30,.20,.14],eyes:[.24,.27,.25],primary:[.28,.35,.30],secondary:[.56,.53,.45],accent:[.58,.48,.31],dark:[.13,.12,.11],metal:[.58,.60,.57],leather:[.28,.19,.13],wood:[.30,.21,.13]}),
  knight:freezePalette({skin:[.88,.70,.60],hair:[.46,.32,.23],eyes:[.30,.34,.36],primary:[.18,.27,.42],secondary:[.82,.80,.73],accent:[.72,.61,.38],dark:[.12,.12,.13],metal:[.76,.78,.76],leather:[.27,.20,.15],wood:[.33,.24,.16]}),
  blacksmith:freezePalette({skin:[.78,.58,.46],hair:[.24,.17,.13],eyes:[.25,.22,.19],primary:[.35,.27,.23],secondary:[.48,.39,.31],accent:[.62,.43,.25],dark:[.12,.11,.10],metal:[.46,.47,.45],leather:[.25,.16,.11],wood:[.31,.20,.12]}),
  laborer:freezePalette({skin:[.86,.66,.53],hair:[.32,.21,.14],eyes:[.30,.25,.18],primary:[.39,.34,.28],secondary:[.70,.64,.54],accent:[.48,.38,.26],dark:[.14,.12,.10],metal:[.48,.49,.47],leather:[.30,.20,.13],wood:[.36,.24,.14]}),
  hunter:freezePalette({skin:[.82,.64,.53],hair:[.31,.21,.15],eyes:[.26,.34,.25],primary:[.27,.35,.25],secondary:[.53,.48,.38],accent:[.50,.40,.25],dark:[.13,.12,.10],metal:[.44,.46,.44],leather:[.27,.18,.12],wood:[.39,.28,.16]}),
  arcanist:freezePalette({skin:[.86,.70,.62],hair:[.36,.30,.35],eyes:[.38,.31,.52],primary:[.30,.24,.42],secondary:[.64,.58,.70],accent:[.65,.54,.32],dark:[.13,.11,.16],metal:[.55,.52,.61],leather:[.25,.18,.23],wood:[.31,.23,.29]})
});
function make({id,label,name=label,referencePath,hair,front,back,design,scale,palette,...style}){
  return Object.freeze({
    id,label,name,kind:'character',sourcePresetId:'model.SHINO',referencePath,
    portraitPath:id==='shino.reference.v2'?null:RAW+referencePath,
    portrait:id==='shino.reference.v2'?'SHINO':null,
    parts:Object.freeze({hair}),front,back,
    referenceStyle:Object.freeze({version:1,design,scale,palette:PALETTE[palette],...style})
  });
}
export const REVIEW_REFERENCE_MODELS=Object.freeze([
  make({id:'shino.reference.v2',label:'Shino Reference v2',name:'Shino Reference v2',referencePath:'docs/characters/references/shino/shino-character-reference-sheet-v2.png',hair:'bob',front:'fringe',back:'layered',design:'shino',scale:.70,palette:'shino',armStyle:'blouse',legStyle:'bare',footwear:'boots',prop:'satchel'}),
  make({id:'child-boy.reference.v1',label:'CHILD_BOY',name:'Child Boy',referencePath:npc('child-boy'),hair:'crop',front:'open',back:'close',design:'child-boy',scale:.61,palette:'villageBoy',armStyle:'shirt',legStyle:'pants',footwear:'boots',prop:'none'}),
  make({id:'child-girl.reference.v1',label:'CHILD_GIRL',name:'Child Girl',referencePath:npc('child-girl'),hair:'bob',front:'fringe',back:'layered',design:'child-girl',scale:.60,palette:'villageGirl',armStyle:'shirt',legStyle:'leggings',footwear:'boots',prop:'ribbon'}),
  make({id:'elderly-man.reference.v1',label:'ELDERLY_MAN',name:'Elderly Man',referencePath:npc('elderly-man'),hair:'crop',front:'swept',back:'close',design:'elderly-man',scale:.82,palette:'elderMan',armStyle:'shirt',legStyle:'pants',footwear:'boots',prop:'cane'}),
  make({id:'elderly-woman.reference.v1',label:'ELDERLY_WOMAN',name:'Elderly Woman',referencePath:npc('elderly-woman'),hair:'tail',front:'parted',back:'tied',design:'elderly-woman',scale:.79,palette:'elderWoman',armStyle:'shirt',legStyle:'skirt',footwear:'boots',prop:'basket',hairExtra:'bun'}),
  make({id:'guard.reference.v1',label:'GUARD',name:'Guard',referencePath:npc('guard'),hair:'crop',front:'open',back:'close',design:'guard',scale:.90,palette:'guard',armStyle:'armor',legStyle:'pants',footwear:'greaves',prop:'spear'}),
  make({id:'knight.reference.v1',label:'KNIGHT',name:'Knight',referencePath:npc('knight'),hair:'crop',front:'swept',back:'layered',design:'knight',scale:.92,palette:'knight',armStyle:'armor',legStyle:'armor',footwear:'greaves',prop:'sword'}),
  make({id:'blacksmith.reference.v1',label:'BLACKSMITH',name:'Blacksmith',referencePath:npc('blacksmith'),hair:'crop',front:'open',back:'close',design:'blacksmith',scale:.91,palette:'blacksmith',armStyle:'rolled',legStyle:'pants',footwear:'boots',prop:'hammer'}),
  make({id:'laborer.reference.v1',label:'LABORER',name:'Laborer',referencePath:npc('laborer'),hair:'crop',front:'open',back:'layered',design:'laborer',scale:.89,palette:'laborer',armStyle:'rolled',legStyle:'pants',footwear:'boots',prop:'toolbelt'}),
  make({id:'hunter.reference.v1',label:'HUNTER',name:'Hunter',referencePath:npc('hunter'),hair:'crop',front:'swept',back:'layered',design:'hunter',scale:.88,palette:'hunter',armStyle:'shirt',legStyle:'pants',footwear:'boots',prop:'bow'}),
  make({id:'arcanist.reference.v1',label:'ARCANIST',name:'Arcanist',referencePath:npc('arcanist'),hair:'tail',front:'parted',back:'tied',design:'arcanist',scale:.86,palette:'arcanist',armStyle:'robe',legStyle:'robe',footwear:'boots',prop:'staff-book'}),
  make({id:'arcanist.atlas-study.v1',label:'ARCANIST_ATLAS_STUDY',name:'Arcanist Atlas Study',referencePath:npc('arcanist'),hair:'tail',front:'parted',back:'tied',design:'arcanist',scale:.86,palette:'arcanist',armStyle:'robe',legStyle:'robe',footwear:'boots',prop:'staff-book',productionStage:'BLOCKOUT',modelingMode:'runtime-procedural',productionReady:false,detailProfile:'arcanist-atlas-v1'})
]);
export const REVIEW_REFERENCE_BY_ID=Object.freeze(Object.fromEntries(REVIEW_REFERENCE_MODELS.map(row=>[row.id,row])));
export function reviewReferenceModel(id){return REVIEW_REFERENCE_BY_ID[id]||null;}
