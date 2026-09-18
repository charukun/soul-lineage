export function createActorStatus({document,canvas,view,layerId='actor-status-layer',actorName='Player',headY=1.65}={}){
  const layer=document?.getElementById?.(layerId),items=new Set(),point=new view.THREE.Vector3();
  let anchor=null;
  const actor=()=>{let owner=anchor;while(owner?.parent)owner=owner.parent;if(owner!==view.scene||anchor?.name!==actorName)anchor=view.scene.getObjectByName(actorName);return anchor;};
  function screenPoint(){
    const node=actor();if(!node)return null;point.set(0,headY,0);node.localToWorld(point);point.project(view.camera);
    return{x:(point.x*.5+.5)*(view.viewport?.width??canvas.clientWidth),y:(-.5*point.y+.5)*(view.viewport?.height??canvas.clientHeight),visible:point.z>=-1&&point.z<=1};
  }
  function sync(){
    if(!items.size)return;const position=screenPoint();if(!position)return;
    for(const item of items){if(item.node.hidden===position.visible)item.node.hidden=!position.visible;const x=`${position.x}px`,y=`${position.y}px`;if(item.node.style.left!==x)item.node.style.left=x;if(item.node.style.top!==y)item.node.style.top=y;}
  }
  function show(text,{duration=2700}={}){
    if(!layer||!text)return null;const node=document.createElement('div'),label=document.createElement('span');node.className='actor-status-anchor';label.className='actor-status-text';label.textContent=String(text);node.append(label);layer.append(node);
    const item={node,timer:0};item.timer=setTimeout(()=>{items.delete(item);node.remove();},Math.max(300,Number(duration)||2700));items.add(item);sync();return item;
  }
  function clear(){for(const item of items){clearTimeout(item.timer);item.node.remove();}items.clear();}
  return{show,sync,clear,dispose:clear};
}
