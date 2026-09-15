export function createActorStatus({document,canvas,view,layerId='actor-status-layer',actorName='Player',headY=1.65}={}){
  const layer=document?.getElementById?.(layerId),items=new Set(),point=new view.THREE.Vector3();
  const actor=()=>view.scene.getObjectByName(actorName);
  function screenPoint(){
    const node=actor();if(!node)return null;node.updateWorldMatrix(true,false);point.set(0,headY,0);node.localToWorld(point);point.project(view.camera);
    return{x:(point.x*.5+.5)*canvas.clientWidth,y:(-.5*point.y+.5)*canvas.clientHeight,visible:point.z>=-1&&point.z<=1};
  }
  function sync(){
    if(!items.size)return;const position=screenPoint();if(!position)return;
    for(const item of items){item.node.hidden=!position.visible;item.node.style.left=`${position.x}px`;item.node.style.top=`${position.y}px`;}
  }
  function show(text,{duration=2700}={}){
    if(!layer||!text)return null;const node=document.createElement('div'),label=document.createElement('span');node.className='actor-status-anchor';label.className='actor-status-text';label.textContent=String(text);node.append(label);layer.append(node);
    const item={node,timer:0};item.timer=setTimeout(()=>{items.delete(item);node.remove();},Math.max(300,Number(duration)||2700));items.add(item);sync();return item;
  }
  function clear(){for(const item of items){clearTimeout(item.timer);item.node.remove();}items.clear();}
  return{show,sync,clear,dispose:clear};
}
