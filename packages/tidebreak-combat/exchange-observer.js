import {createJohakyuExchangeState,reduceJohakyuExchange,johakyuExchangeSnapshot} from '@soul/johakyu-combat/exchange-policy';

/** Bounded transient observation journal. No timers, collisions, resources or AI locks. */
export function createTidebreakExchangeObserver(){
  let states=new Map(),events=[],revision=0;
  const key=(a,b)=>[String(a),String(b)].sort().join('::');
  function between(sourceId,targetId){return states.get(key(sourceId,targetId))??createJohakyuExchangeState({sourceId:String(sourceId),targetId:String(targetId)});}
  function observe(event){
    if(event.sourceId==null||event.targetId==null||event.sourceId===event.targetId)return null;
    const sourceId=String(event.sourceId),targetId=String(event.targetId),before=between(sourceId,targetId),after=reduceJohakyuExchange(before,{...event,sourceId,targetId});
    states.set(key(sourceId,targetId),after);
    const row=Object.freeze({...event,sourceId,targetId,revision:++revision,exchange:johakyuExchangeSnapshot(after)});
    events.push(row);if(events.length>64)events.shift();return row;
  }
  return Object.freeze({between,observe,beginStep(){events=[];},reset(){states=new Map();events=[];revision=0;},snapshot(){return {exchangeEvents:[...events],exchanges:[...states.values()].map(johakyuExchangeSnapshot)};}});
}
