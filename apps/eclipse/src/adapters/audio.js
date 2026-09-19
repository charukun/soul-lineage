/** Original procedural sound design. No downloaded music; never a media session. */
export class Sound {
  constructor(volume=.35){this.volume=volume;this.muted=false;this.ctx=null;this.nodes=[];}
  async start(){
    if(!this.ctx){
      const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;
      this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.gain.value=this.volume*.32;this.master.connect(this.ctx.destination);
      const buffer=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;this.noiseBuffer=buffer;
      for(const hz of [55,82.4069,110,164.8138]){const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='sine';o.frequency.value=hz;g.gain.value=.035;o.connect(g);g.connect(this.master);o.start();this.nodes.push(o);}
    }
    if(this.ctx.state==='suspended'&&!document.hidden)await this.ctx.resume();
  }
  volumeTo(v){this.volume=v;this.apply();}
  apply(){if(this.master)this.master.gain.setTargetAtTime(this.muted?0:this.volume*.32,this.ctx.currentTime,.06);}
  toggle(){this.muted=!this.muted;this.apply();return!this.muted;}
  suspend(){if(this.ctx?.state==='running')this.ctx.suspend().catch(()=>{});}
  async resume(){if(!document.hidden&&this.ctx?.state==='suspended')await this.ctx.resume();}
  tone(hz,duration,volume=.3,type='sine',endHz=hz){if(!this.ctx||this.ctx.state!=='running'||this.muted)return;const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(hz,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,endHz),t+duration);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.03);o.onended=()=>{o.disconnect();g.disconnect();};}
  noise(duration=.12,volume=.35,hz=1200){if(!this.ctx||this.ctx.state!=='running'||this.muted)return;const t=this.ctx.currentTime,s=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();s.buffer=this.noiseBuffer;f.type='lowpass';f.frequency.setValueAtTime(hz,t);f.frequency.exponentialRampToValueAtTime(160,t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);s.connect(f);f.connect(g);g.connect(this.master);s.start(t);s.stop(t+duration);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};}
  hit(big=false){this.noise(big?.24:.12,big?.65:.35,big?2200:1700);this.tone(big?105:210,big?.32:.12,big?.6:.3,'triangle',45);}
  slash(){this.noise(.18,.4,4600);this.tone(720,.1,.05,'sine',210);}
  frost(){this.noise(.7,.4,7200);for(const [i,h]of [880,1320,1760].entries())this.tone(h,.65+i*.15,.09);}
  nova(){this.hit(true);this.tone(60,.75,.9,'sine',25);this.noise(.8,.5,5000);this.tone(440,.7,.15);}
  bell(){this.tone(440,1,.25);this.tone(660,.8,.14);this.tone(880,1.5,.1);}
  hurt(){this.tone(110,.18,.35,'sawtooth',55);}
}
