const SVG_NS='http://www.w3.org/2000/svg';
const whole=value=>Math.max(0,Math.floor(Number(value)||0));

export function populationHistorySeries(history,maxPoints=48){
 const points=(Array.isArray(history)?history:[]).filter(item=>item&&Number.isFinite(Number(item.year))).map(item=>({year:whole(item.year),population:whole(item.population),births:whole(item.births),deaths:whole(item.deaths),departures:whole(item.departures),children:whole(item.children),youth:whole(item.youth),adults:whole(item.adults),elders:whole(item.elders)})).sort((a,b)=>a.year-b.year);
 return points.slice(-Math.max(2,whole(maxPoints)||48));
}

function linePath(points,x,y){return points.map((point,index)=>`${index?'L':'M'} ${x(point,index).toFixed(2)} ${y(point).toFixed(2)}`).join(' ');}
function svgEl(name,attributes={}){const node=document.createElementNS(SVG_NS,name);for(const[key,value]of Object.entries(attributes))node.setAttribute(key,String(value));return node;}

export function installPopulationHistory({world}){
 const dialog=document.createElement('dialog');dialog.id='muraPopulationHistory';dialog.className='muraPopulationHistory';
 dialog.innerHTML='<header><div><small>村の年代</small><h2>人口推移</h2></div><button type="button" class="populationHistoryBack">設定へ</button></header><div class="populationHistorySummary"></div><div class="populationChartWrap"><svg class="populationChart" viewBox="0 0 640 270" role="img" aria-label="村の人口、出生、死亡と離村の推移"></svg></div><div class="populationLegend"><span class="populationLegendPopulation">人口</span><span class="populationLegendBirth">出生</span><span class="populationLegendLoss">死亡・離村</span></div><p class="populationHistoryNote">村の世界時間で1年ごとに記録します。実時間ではなく、村で進んだ時間そのものが横軸です。</p><form method="dialog"><button>閉じる</button></form>';
 document.body.append(dialog);
 const chart=dialog.querySelector('.populationChart'),summary=dialog.querySelector('.populationHistorySummary'),back=dialog.querySelector('.populationHistoryBack');let reopenSettings=null;

 function render(){
  const current=world.population(),cohorts=window.__MURA_SYSTEMS__?.cohortCounts?.()||{},stored=world.state.muraSystems?.demography?.history||[],fallback={year:Math.floor(world.state.clock/12)+1,population:current.people,births:0,deaths:0,departures:0,children:cohorts.children||0,youth:cohorts.youth||0,adults:cohorts.adults||current.people,elders:cohorts.elders||0},points=populationHistorySeries(stored.length?stored:[fallback]),latest=points.at(-1)||fallback;
  summary.innerHTML=`<span><small>人口</small><b>${latest.population}</b></span><span><small>子ども</small><b>${latest.children}</b></span><span><small>青年</small><b>${latest.youth}</b></span><span><small>成人</small><b>${latest.adults}</b></span><span><small>高齢者</small><b>${latest.elders}</b></span>`;
  chart.replaceChildren();
  const width=640,left=48,right=18,top=24,popBottom=176,eventTop=205,eventBottom=246,plotWidth=width-left-right,maxPop=Math.max(4,...points.map(point=>point.population)),maxEvent=Math.max(1,...points.map(point=>Math.max(point.births,point.deaths+point.departures))),x=(_,index)=>points.length===1?left+plotWidth/2:left+plotWidth*index/(points.length-1),yPop=point=>popBottom-(popBottom-top)*(point.population/maxPop),eventBase=(eventTop+eventBottom)/2,eventHalf=(eventBottom-eventTop)/2-2;
  for(let i=0;i<=4;i++){const y=top+(popBottom-top)*i/4,line=svgEl('line',{x1:left,y1:y,x2:width-right,y2:y,class:'populationGrid'});chart.append(line);const label=svgEl('text',{x:left-8,y:y+4,'text-anchor':'end',class:'populationAxis'});label.textContent=String(Math.round(maxPop*(1-i/4)));chart.append(label);}
  const path=svgEl('path',{d:linePath(points,x,yPop),class:'populationLine'});chart.append(path);
  for(const[ index,point]of points.entries()){
   const px=x(point,index),barWidth=Math.max(3,Math.min(10,plotWidth/Math.max(10,points.length)*.46)),birthHeight=eventHalf*(point.births/maxEvent),lossHeight=eventHalf*((point.deaths+point.departures)/maxEvent);
   if(birthHeight>0)chart.append(svgEl('rect',{x:px-barWidth-1,y:eventBase-birthHeight,width:barWidth,height:birthHeight,class:'populationBirthBar'}));
   if(lossHeight>0)chart.append(svgEl('rect',{x:px+1,y:eventBase,width:barWidth,height:lossHeight,class:'populationLossBar'}));
  }
  chart.append(svgEl('line',{x1:left,y1:eventBase,x2:width-right,y2:eventBase,class:'populationEventBaseline'}));
  const first=points[0],last=points.at(-1),firstLabel=svgEl('text',{x:left,y:263,class:'populationAxis'}),lastLabel=svgEl('text',{x:width-right,y:263,'text-anchor':'end',class:'populationAxis'});firstLabel.textContent=`${first.year}年`;lastLabel.textContent=`${last.year}年`;chart.append(firstLabel,lastLabel);
  const title=svgEl('title');title.textContent=`${first.year}年から${last.year}年。現在人口${latest.population}人。直近年の出生${latest.births}人、死亡${latest.deaths}人、離村${latest.departures}人。`;chart.prepend(title);
 }
 function open(){const host=document.getElementById('dialog');if(host?.open)host.close();render();if(!dialog.open)dialog.showModal();}
 function attachSettings(root,onBack){const grid=root?.querySelector?.('.settingsGrid');if(!grid)return false;reopenSettings=onBack;let button=grid.querySelector('#muraPopulationHistoryOpen');if(!button){button=document.createElement('button');button.id='muraPopulationHistoryOpen';button.textContent='人口推移';button.onclick=open;grid.append(button);}return true;}
 back.onclick=()=>{dialog.close();reopenSettings?.();};
 return{open,render,attachSettings,dialog};
}
