function spawnEnemy(){
 const a=rand()*TAU,r=randRange(6.8,8.5),kind=game.wave>1&&game.spawned%4===3?'mage':game.spawned%3===0?'warrior':'minion';
 const boss=game.wave===5&&game.spawned===game.waveCount-1;
 const unit=actor(boss?'warrior':kind,new V(Math.cos(a)*r,0,Math.sin(a)*r),boss);
 if(boss){show('boss-hud');game.boss=unit;banner('灰の王','THE LAST OATH');record('boss-spawn');}
 game.spawned++;record('spawn',{kind:unit.kind,boss});
}
function wave(){
 game.wave++;game.waveCount=[0,6,8,10,12,10][game.wave];game.spawned=0;game.spawnTimer=.8;game.phase='battle';game.banner=3.5;
 banner(`襲撃 ${String(game.wave).padStart(2,'0')}`,game.wave===5?'THE FINAL INCURSION':'THE WOODS ARE WATCHING');
 $('wave-label').textContent=`襲撃 ${String(game.wave).padStart(2,'0')}`;
 [...$('wave-pips').children].forEach((e,i)=>e.classList.toggle('active',i<game.wave));record('wave',{wave:game.wave});
}
function banner(text,sub){$('wave-banner').querySelector('span').textContent=text;$('wave-banner').querySelector('small').textContent=sub;$('wave-banner').classList.add('show');game.banner=3;}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');game.toast=2.2;}
function start(){
 for(const a of actors)removeActor(a);actors=[];particles=[];projectiles=[];arcs=[];rings=[];numbers=[];
 Object.assign(game,{phase:'battle',time:0,wave:0,kills:0,damage:0,received:0,bursts:0,energy:0,level:1,moveTarget:null,boss:null,shake:0,hitstop:0});
 $('level-label').textContent='LV. 1';hero=actor('hero',new V(0,0,2.5));hero.object.rotation.y=Math.PI;
 for(const id of ['title','ending','paused','upgrade','boss-hud'])show(id,false);show('hud');$('move-hint').style.opacity='1';cameraTarget.copy(hero.pos).multiplyScalar(.15);wave();record('start');
}
function title(){
 for(const a of actors)removeActor(a);actors=[];particles=[];projectiles=[];arcs=[];rings=[];numbers=[];
 hero=actor('hero',new V(1,0,1));hero.object.rotation.y=-.5;
 for(const id of ['hud','ending','paused','upgrade','boss-hud'])show(id,false);show('title');game.phase='title';intro=0;
 const dummy=actor('warrior',new V(-4,0,-4));dummy.object.rotation.y=.7;dummy.spawn=0;play(dummy,'Idle');
 const dummy2=actor('mage',new V(4,0,-5.5));dummy2.object.rotation.y=-.5;dummy2.spawn=0;play(dummy2,'Idle');
}
function chooseUpgrade(choice){
 if(game.phase!=='upgrade')return;
 if(choice==='power')hero.damage*=1.22;
 else if(choice==='vitality'){hero.maxHp+=40;hero.hp=Math.min(hero.maxHp,hero.hp+85);}
 else hero.attackSpeed*=1.15;
 hero.hp=Math.min(hero.maxHp,hero.hp+25);game.level++;$('level-label').textContent='LV. '+game.level;show('upgrade',false);record('upgrade',{choice});wave();
}
function ending(win){
 game.phase=win?'victory':'defeat';for(const id of ['upgrade','boss-hud','paused'])show(id,false);show('ending');
 $('end-eyebrow').textContent=win?'THE FIRST LIGHT':'AN UNFINISHED OATH';$('end-title').textContent=win?'夜明けに、剣を置く。':'誓いは、まだ消えない。';$('end-copy').textContent=win?'灰の森に、静けさが戻った。':'構えと強化を変えて、もう一度。';
 $('end-stats').innerHTML=`<div><b>${game.kills}</b><span>討伐数</span></div><div><b>${formatTime(game.time)}</b><span>生存時間</span></div><div><b>${game.bursts}</b><span>暁の一閃</span></div>`;
 if(win){play(hero,'Cheer');record('victory');}
}
function pause(){
 if(game.phase==='paused'){game.phase=game.pausedFrom;show('paused',false);}
 else if(game.phase==='battle'||game.phase==='upgrade'){game.pausedFrom=game.phase;game.phase='paused';show('paused');}
}
function formatTime(t){return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;}
