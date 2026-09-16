const trackers=new WeakMap();
/** Three.js hierarchy changes include async GLB replacement and same-count swaps. */
export function createVisualSceneTracker(roots){
 const records=new Map();
 for(const root of roots){
  const listeners=new Map(),record={revision:1,listeners};records.set(root,record);
  function attach(node){
   if(listeners.has(node))return;
   const added=event=>{attach(event.child);record.revision++;};
   const removed=event=>{detach(event.child);record.revision++;};
   node.addEventListener('childadded',added);node.addEventListener('childremoved',removed);listeners.set(node,{added,removed});
   for(const child of node.children)attach(child);
  }
  function detach(node){
   const row=listeners.get(node);if(!row)return;
   node.removeEventListener('childadded',row.added);node.removeEventListener('childremoved',row.removed);listeners.delete(node);
   for(const child of node.children)detach(child);
  }
  record.detach=detach;attach(root);
 }
 return{revision:root=>records.get(root)?.revision||0,dispose(){for(const[root,row]of records)row.detach(root);records.clear();}};
}
export function visualSceneTrackerFor(view){
 let tracker=trackers.get(view);
 if(!tracker){tracker=createVisualSceneTracker([view.objects,view.outside,view.inside,view.actors]);trackers.set(view,tracker);}
 return tracker;
}
