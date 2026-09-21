export function createReviewSvgThumbnail(url,{label='',className='review-static-thumbnail',decorative=false,doc=document}={}){
  const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
  if(className)svg.setAttribute('class',className);
  svg.setAttribute('viewBox','0 0 160 160');
  if(decorative){svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');}
  else{svg.setAttribute('aria-label',label);svg.setAttribute('role','img');}
  const use=doc.createElementNS(svg.namespaceURI,'use');
  use.setAttribute('href',url);
  svg.append(use);
  return svg;
}
