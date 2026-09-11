import fs from 'node:fs';
import assert from 'node:assert/strict';
import { resolve, sep } from 'node:path';
const output = resolve('test-results/village') + sep;
fs.mkdirSync(output, { recursive: true });
import {World,defs,ready,unlocked,RESOURCE_NAMES} from '../src/game/core.js';
import {Simulation} from '../src/game/simulation.js';
const w=new World(),sim=new Simulation(w),records=[],pending=[
 ['tent',-22,12],['logging',-32,-25],['wheat',-10,-44],['tent',25,13],['tent',-25,33],
 ['carpenter',14,-30],['guardpost',-8,23],['storage',43,-22],['quarry',30,-60],['clay',-44,28],['market',22,37],
 ['wheat',16,-46],['tent',-8,43],['tent',45,15],['guardpost',-43,7],['home',48,38],['home',-24,57],
 ['watchtower',44,59],['guardpost',26,60],['wheat',-6,-65],['wheat',42,38],['home',-5,65],['home',15,80],
 ['school',-17,-64],['smith',-24,-82],['farm',15,45],['clinic',-43,45],['tavern',3,90],['furniture',-25,83]
].map(([kind,x,z])=>({kind,x,z,tries:0}));
for(let t=0;t<3600;t++){
 if(t%5===0){for(const p of pending){if(p.objectId||!unlocked(w.state,p.kind))continue;let result=w.add(p.kind,p.x,p.z);p.tries++;if(result.error&&/重な|入口/.test(result.error)){for(let r=10;r<=30&&!result.ok;r+=10)for(let a=0;a<6.28&&!result.ok;a+=.6){const x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(!w.canPlace(p.kind,x,z)){result=w.add(p.kind,x,z);}}}if(result.ok){p.objectId=result.object.id;records.push({time:t,placed:p.kind,id:p.objectId});}else p.error=result.error;}}
 sim.update(1);
 if(t%100===0){for(const o of w.objects)if(ready(o)&&['quarry','logging','wheat','guardpost','storage'].includes(o.kind)&&o.level===1&&!o.upgrade&&w.canAfford(w.upgradeCost(o)))w.upgrade(o.id);}
 if(t%300===0)records.push({time:t,population:w.population(),stats:{...w.state.stats},stock:{...w.state.stock},roles:w.people.map(p=>[p.name,p.role,defs[w.object(p.jobId)?.kind]?.label])});
 if(t%300===0)new World(JSON.parse(w.export()));
}
const result={simulationSeconds:3600,population:w.population(),stats:w.state.stats,known:w.state.known,unfinished:pending.filter(p=>!p.objectId),resources:w.state.stock,records};
fs.writeFileSync(output+'progression.json',JSON.stringify(result,null,2));
fs.writeFileSync(output+'settled-village.json',w.export());
console.log(JSON.stringify({population:result.population,stats:result.stats,known:result.known,unfinished:result.unfinished,people:w.people.map(p=>({name:p.name,job:w.object(p.jobId)?.kind,hunger:p.hunger,hp:p.health}))},null,2));
assert.ok(w.state.stats.produced>100);assert.ok(w.state.stats.meals>10);assert.ok(w.state.stats.purchases>0);assert.ok(w.state.stats.furnished>0);assert.ok(w.state.stats.raids>=3);assert.ok(w.state.known.includes('plank'));assert.ok(w.state.known.includes('stone'));assert.ok(w.people.length>6);assert.ok(w.state.stats.losses<=2,'Defended settlement must not suffer repeated losses');assert.ok(w.objects.some(o=>o.level>1));
