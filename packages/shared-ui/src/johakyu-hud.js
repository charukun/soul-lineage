const WAVE_MAAI='<svg viewBox="0 0 42 18" aria-hidden="true"><path d="M1 9h6c2.2 0 2.8-2.2 4.1-2.2l2.6 6.7L17.2 2l3.7 14.1 3.5-9.7 2.7 4.2c1.1 1.7 2.4 2.4 4.3 2.4H41"/></svg>';
const WAVE_ZANSHIN='<svg viewBox="0 0 42 18" aria-hidden="true"><path d="M1 9h5.5c2.1 0 2.7-1.8 4-1.8l2.5 5.6L16.3 4l3.4 10.9 3.4-7.7 2.8 3.6c1.2 1.5 2.6 2.2 4.6 2.2H41"/></svg>';
const PHASES=[['jo','序'],['ha','破'],['kyu','急']];
export function johakyuSequenceMarkup({battle2=false}={}){
  const lanes=PHASES.map(([phase,label])=>'<span class="battle-sequence-technique-lane" data-technique-phase="'+phase+'" aria-label="'+label+'の技"></span>').join('');
  const steps=PHASES.map(([phase,label],index)=>
    (index?'<i class="battle-sequence-hud__wave combat-sequence__link" data-combat-link="'+(index===1?'jo-ha':'ha-kyu')+'"'+(battle2?'':' data-link="'+(index===1?'jo-ha':'ha-kyu')+'"')+' aria-hidden="true"></i>':'')+
    '<span class="battle-sequence-hud__step combat-sequence__step" data-combat-phase="'+phase+'"'+(battle2?' data-active="false"':' data-phase-id="'+phase+'"')+'>'+label+'</span>'
  ).join('');
  const top=battle2?'<div id="battle-sequence-hud" class="battle-sequence-hud" aria-live="polite" hidden>':'<div data-phase class="combat-phase-indicator battle-sequence-hud" data-combat-sequence data-combat-sequence-phase="idle" hidden aria-label="間合いから残心までの序破急">';
  const laneHost=battle2?'<div id="battle-sequence-techniques" class="battle-sequence-techniques" aria-label="序破急で使用した技">':'<div data-phase-techniques class="battle-sequence-techniques" aria-label="序破急で使用した技">';
  const track=battle2?'<aside id="battle-phase" class="battle-sequence-hud__phase combat-sequence combat-sequence--flat" data-combat-sequence data-combat-sequence-phase="idle" data-phase="idle" aria-label="間合いから残心までの序破急">':'<aside class="battle-sequence-hud__phase combat-sequence combat-sequence--flat" data-phase-track data-phase="idle">';
  const finisher=battle2?'<span id="battle-sequence-finisher" class="battle-sequence-finisher" hidden></span>':'';
  const tail=battle2?'<strong id="battle-sequence-current" class="battle-sequence-current" data-kind="idle"></strong><div id="battle-sequence-history" class="battle-sequence-history" aria-label="戦闘ログ"></div>':'<span data-exchange-cue class="combat-exchange-cue" role="status" hidden></span><strong data-phase-action class="combat-phase-action combat-sequence__action" hidden></strong><div data-phase-history class="combat-phase-history combat-sequence__history" aria-live="polite"></div>';
  return top+laneHost+lanes+'</div>'+track+
    '<span class="battle-sequence-hud__edge battle-sequence-hud__edge--maai" aria-hidden="true">'+WAVE_MAAI+'</span>'+
    steps+'<span class="battle-sequence-hud__edge battle-sequence-hud__edge--zanshin">'+finisher+WAVE_ZANSHIN+'</span></aside>'+tail+'</div>';
}
