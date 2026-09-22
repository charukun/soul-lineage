export function worldDetailBudget(viewportWidth=1024){
 const width=Math.max(0,Number(viewportWidth)||0);
 if(width<=760)return Object.freeze({forestTrees:56,edgeProps:72,tier:'mobile'});
 if(width<=1180)return Object.freeze({forestTrees:78,edgeProps:96,tier:'compact'});
 return Object.freeze({forestTrees:100,edgeProps:130,tier:'full'});
}

export function titleWorldDetailBudget(viewportWidth=1024){
 const width=Math.max(0,Number(viewportWidth)||0);
 if(width<=760)return Object.freeze({forestTrees:18,edgeProps:24,graves:4,architectureEntities:4,tier:'title-mobile'});
 if(width<=1180)return Object.freeze({forestTrees:26,edgeProps:34,graves:6,architectureEntities:6,tier:'title-compact'});
 return Object.freeze({forestTrees:36,edgeProps:48,graves:8,architectureEntities:8,tier:'title-full'});
}
