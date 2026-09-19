export class Audio {
  constructor(){this.enabled=false;this.context=null;this.ambientClock=0;}
  toggle(){this.enabled=!this.enabled;if(this.enabled)this.unlock();return this.enabled;}
  unlock(){try{this.context??=new (window.AudioContext||window.webkitAudioContext)();if(this.context.state==='suspended')this.context.resume();}catch{this.enabled=false;}}
  tone(frequency,duration=.2,volume=.05,type='sine',delay=0){if(!this.enabled||!this.context)return;const a=this.context,t=a.currentTime+delay,o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(frequency,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(a.destination);o.start(t);o.stop(t+duration+.05);}
  event(e){if(!this.enabled)return;if(e.type==='hit'){this.tone(e.unit.team==='hero'?105:170,.08,.023,'triangle');if(e.critical)this.tone(740,.19,.025);}if(e.type==='attack'&&e.ranged)this.tone(460,.24,.022,'sine');if(e.type==='bell'){for(const [i,f] of [196,294,392,588,784].entries())this.tone(f,2.5-i*.2,.028,'sine',i*.05);}if(e.type==='wave')this.tone(98,1.3,.025);if(e.type==='boon')for(const [i,f]of[294,392,587].entries())this.tone(f,1,.035,'sine',i*.14);}
  update(dt){if(!this.enabled)return;this.ambientClock-=dt;if(this.ambientClock<=0){this.ambientClock=4.6;for(const [i,f]of[73.42,110,146.83,220].entries())this.tone(f,4.8,.009,'sine',i*.3);}}
}
