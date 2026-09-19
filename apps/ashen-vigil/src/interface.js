import {HEROES,WAVES} from './game.js';
const $=id=>document.getElementById(id);
export class Interface {
  constructor(game,callbacks){
    this.game=game;this.callbacks=callbacks;this.lastState='';this.announceTimer=0;this.lastWave=0;
    $('party').innerHTML=HEROES.map(h=>`<div class="hero-card" id="hero-${h.kind}" style="--hero-color:${h.color}"><img alt="${h.name}" id="portrait-${h.kind}"><div class="details"><small class="role">${h.role}</small><b>${h.name}</b><div class="hp-track"><i></i></div><small class="hp-numbers"></small></div></div>`).join('');
    $('start').onclick=callbacks.start;$('restart').onclick=callbacks.start;$('resume').onclick=()=>game.togglePause();$('pause').onclick=()=>game.togglePause();$('back-title').onclick=callbacks.home;$('result-home').onclick=callbacks.home;
    $('speed').onclick=()=>{game.speed=game.speed===1?2:1;$('speed').textContent=game.speed+'×';};$('bell').onclick=()=>game.bell();
    const sound=()=>{const enabled=callbacks.sound();$('title-sound').textContent=enabled?'音声 ON':'音声 OFF';$('sound').textContent=enabled?'♫':'♪';$('sound').setAttribute('aria-pressed',String(enabled));};$('sound').onclick=sound;$('title-sound').onclick=sound;
    document.querySelector('[data-credits]').onclick=()=>$('credits').showModal();$('credits-close').onclick=()=>$('credits').close();
    document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['BUTTON','INPUT'].includes(e.target.tagName)){e.preventDefault();game.bell();}if(e.key==='Escape'&&!$('credits').open)game.togglePause();});
  }
  event(e){
    if(e.type==='wave'){this.announceTimer=3.2;$('announcement').innerHTML=`<small>NIGHT ${String(e.wave).padStart(2,'0')}</small>${e.name}`;$('announcement').classList.add('show');this.lastWave=e.wave;$('chapter-label').textContent='第'+['一','二','三','四','五','六'][e.wave-1]+'夜';$('wave-caption').textContent=WAVES[e.wave-1];$('wave-dots').innerHTML=Array.from({length:6},(_,i)=>`<i class="${i+1===e.wave?'active':i+1<e.wave?'done':''}"></i>`).join('');}
    if(e.type==='choice'){$('choices').innerHTML='';this.game.choices.forEach((b,i)=>{const button=document.createElement('button');button.className='choice-card';button.dataset.index=i;button.innerHTML=`<span class="icon">${b.icon}</span><small>${b.en}</small><b>${b.name}</b><p>${b.text.replace('\n','<br>')}</p>`;button.onclick=()=>this.game.choose(i);$('choices').append(button);});}
    if(e.type==='boon')$('boons').innerHTML=this.game.boons.map(id=>{const b=this.game.choices.find(b=>b.id===id);return `<span title="${id}">${b?.icon||'✧'}</span>`;}).join('');
    if(e.type==='result'){const win=e.win;$('result-kicker').textContent=win?'DAWN BREAKS':'THE LAST EMBER';$('result-title').textContent=win?'そして、夜は明ける。':'それでも、火は残る。';$('result-description').textContent=win?'灰の底で守り抜いた、小さな灯。三人の誓いは、新しい朝へ。':'巡礼はここで途絶えた。けれど、次の灯はもう、あなたの手の中に。';$('result-stats').innerHTML=`<div><b>${this.game.kills}</b><small>討伐した亡者</small></div><div><b>${Math.floor(this.game.time/60)}:${String(Math.floor(this.game.time%60)).padStart(2,'0')}</b><small>巡礼の時間</small></div><div><b>${this.game.wave}/6</b><small>越えた夜</small></div>`;try{const best=JSON.parse(localStorage.getItem('ashen-vigil-record')||'{}');if(this.game.kills>(best.kills||0))localStorage.setItem('ashen-vigil-record',JSON.stringify({kills:this.game.kills,time:this.game.time,win}));}catch{}}
  }
  reset(){$('boons').innerHTML='';$('speed').textContent=this.game.speed+'×';this.lastState='';}
  update(dt){
    const g=this.game,s=g.state;
    if(s!==this.lastState){this.lastState=s;$('title').classList.toggle('hidden',s!=='title');$('hud').classList.toggle('hidden',s==='title');$('choice').classList.toggle('hidden',s!=='choice');$('paused').classList.toggle('hidden',s!=='paused');$('result').classList.toggle('hidden',!['win','lose'].includes(s));document.body.classList.toggle('playing',s!=='title');}
    if(s==='title')return;
    this.announceTimer-=dt;if(this.announceTimer<=0)$('announcement').classList.remove('show');
    $('embers').textContent=g.embers;$('kills').textContent='討伐 '+g.kills;$('timer').textContent=String(Math.floor(g.time/60)).padStart(2,'0')+':'+String(Math.floor(g.time%60)).padStart(2,'0');
    for(const h of g.heroes){const card=$('hero-'+h.kind);card.classList.toggle('dead',h.dead);card.querySelector('.hp-track i').style.width=(h.hp/h.maxHp*100)+'%';card.querySelector('.hp-numbers').textContent=Math.ceil(h.hp)+' / '+Math.round(h.maxHp);}
    const boss=g.enemies().find(e=>e.kind==='boss');$('boss').classList.toggle('hidden',!boss);if(boss)$('boss-hp').style.width=(boss.hp/boss.maxHp*100)+'%';
    $('bell').disabled=g.bellCooldown>0||s!=='combat';$('bell-label').textContent=g.bellCooldown>0?Math.ceil(g.bellCooldown)+'秒':'使用可能';$('bell-cooldown').style.height=g.bellCooldown/g.bellMax*100+'%';
    if(s==='choice')$('choice-timer').textContent=Math.ceil(g.choiceTime)+'秒後に自動で選択';
  }
}
