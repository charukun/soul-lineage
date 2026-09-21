export function worldDetailBudget(viewportWidth=1024){
 const width=Math.max(0,Number(viewportWidth)||0);
 if(width<=760)return Object.freeze({forestTrees:56,edgeProps:72,tier:'mobile'});
 if(width<=1180)return Object.freeze({forestTrees:78,edgeProps:96,tier:'compact'});
 return Object.freeze({forestTrees:100,edgeProps:130,tier:'full'});
}
