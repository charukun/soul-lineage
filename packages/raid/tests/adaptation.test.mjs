import test from 'node:test';
import assert from 'node:assert/strict';
import {ProfileStore} from '../profile.js';
import {offerVillages} from '../world.js';
import {RaidSession} from '../session.js';

const memory=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}};
function storeAt(){let now=1_000;return new ProfileStore(memory(),()=> 'adaptive-player',()=>++now);}
const still={x:0,z:0,amount:0};

test('devoured powers become permanent abilities and forms evolve without loadout choices',()=>{
 const s=storeAt();
 s.unlock('smith');s.unlock('arcanist');
 s.change(p=>{p.equipped=[];});
 const p=s.read(),g=new RaidSession(offerVillages(s)[0],p);
 assert.equal(p.form,'stalker');
 assert.equal(g.has('smith'),true);assert.equal(g.has('arcanist'),true);
 assert.equal(g.getMaxHP(),295);
});

test('opponent movement is recorded and used by later automatic combat',()=>{
 const s=storeAt();
 assert.equal(s.learn('knight','stone'),true);
 assert.equal(s.learn('knight','stone'),false);
 const p=s.read();assert.equal(p.adaptations.knight.encounters,2);assert.deepEqual(p.adaptations.knight.moves,['stone']);
 const g=new RaidSession(offerVillages(s)[0],p),set=g.skillSet();
 assert.equal(set.loadout.ha.id,'stone');assert.match(set.loadout.ha.name,/写し/);
});

test('defeat closes one life and begins the next while inherited learning remains',()=>{
 const s=storeAt(),v=offerVillages(s)[0];s.claim(v);s.unlock('traveller');s.learn('traveller','dancer');s.finish(v.id,'defeated',2);
 const p=s.read();assert.equal(p.lives.length,1);assert.equal(p.lives[0].number,1);assert.equal(p.lives[0].status,'defeated');
 assert.ok(p.lives[0].knownPowers.includes('traveller'));assert.ok(p.lives[0].knownMoves.includes('dancer'));
 assert.equal(p.currentLife.number,2);assert.equal(p.currentLife.hunts,0);assert.ok(p.unlocked.includes('traveller'));assert.ok(p.adaptations.traveller.moves.includes('dancer'));
});

test('idle raid body starts a slow wander and direct input takes control immediately',()=>{
 const s=storeAt(),g=new RaidSession(offerVillages(s)[0],s.read());g.village.npcs=[];
 const start={x:g.player.x,z:g.player.z};for(let i=0;i<330;i++)g.tick(1/60,still);
 assert.equal(g.player.autoRoam,true);assert.ok(Math.hypot(g.player.x-start.x,g.player.z-start.z)>.05);
 g.tick(1/60,{x:1,z:0,amount:1});assert.equal(g.player.autoRoam,false);assert.equal(g.idleFor,0);
});

test('sustained retreat can peel out of combat instead of hard locking the player',()=>{
 const s=storeAt(),events=[],g=new RaidSession(offerVillages(s)[0],s.read(),{event:e=>events.push(e)});const n=g.village.npcs[0];
 g.player.x=0;g.player.z=0;n.x=0;n.z=-2;g.engage(n);const hp=g.player.hp,ehp=n.hp;
 g.fight.core={input(){},step(){return{hero:{x:0,z:3,yaw:0,hp,pose:null,slot:'jo',skill:'retreat',progress:0,moveSpeed:1,dead:false},enemy:{x:0,z:-2,yaw:0,hp:ehp,pose:null,dead:false}}}};
 for(let i=0;i<70&&g.fight;i++)g.tick(1/60,{x:0,z:1,amount:1});
 assert.equal(g.fight,null);assert.ok(g.safeTime>0);assert.ok(events.some(e=>e.type==='disengage'));
});
EOF