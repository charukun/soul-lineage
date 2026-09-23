export function createBodySilhouette({parts,interactive=false,doc=document}={}){
  const figure=doc.createElement('div');
  figure.className='body-silhouette__figure'+(interactive?' combat-body-hud__map':'');
  if(interactive)figure.setAttribute('aria-label','身体部位。タップで詳細');
  else{figure.setAttribute('role','img');figure.setAttribute('aria-label','身体部位の耐久');}
  const nodes=new Map();
  for(const part of parts){
    const node=doc.createElement(interactive?'button':'i');node.dataset.bodyPart=part;
    node.className='body-silhouette__part'+(interactive?' combat-body-hud__part':'');
    if(interactive){
      node.type='button';node.setAttribute('aria-pressed','false');
      const label=doc.createElement('span');label.className='combat-body-hud__sr';node.append(label);
    }
    const liquid=doc.createElement('b');liquid.className='body-silhouette__liquid';liquid.setAttribute('aria-hidden','true');
    node.append(liquid);figure.append(node);nodes.set(part,{node,liquid});
  }
  return{figure,parts:nodes};
}
