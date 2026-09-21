/** Shared RINNE stamina mechanics. Callers own the clock and skill modifiers. */
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
export function spendActionStamina(state,amount){
  if(!Number.isFinite(amount)||amount<0)throw new TypeError('Invalid stamina cost');
  if(state.stamina<amount)return false;
  state.stamina-=amount;state.staminaCap=Math.max(22,state.staminaCap-amount*.08);state.lastSpendSeconds=0;return true;
}
export function recoverActionStamina(state,dt,{capBase=100,recovery=0}={}){
  if(!Number.isFinite(dt)||dt<0||dt>.25)throw new TypeError('Invalid real-time step');
  state.staminaCap=clamp(Math.min(state.staminaCap,capBase),22,100);state.lastSpendSeconds+=dt;
  if(state.moving){state.stamina=Math.min(state.staminaCap,state.stamina+4*dt);return;}
  state.idleSeconds+=dt;if(state.idleSeconds>=.48&&!state.activity&&!state.combat)state.resting=true;
  const rest=state.resting&&state.idleSeconds>=.35;
  if(state.lastSpendSeconds>=.55)state.stamina=Math.min(state.staminaCap,state.stamina+(rest?32:14)*dt);
  if(rest)state.staminaCap=Math.min(capBase,state.staminaCap+8*dt);else if(state.lastSpendSeconds>=6)state.staminaCap=Math.min(capBase,state.staminaCap+.2*dt);
  if(rest&&state.hp<state.maxHp)state.hp=Math.min(state.maxHp,state.hp+1.2*(1+recovery)*dt);
  if(rest&&state.zone==='village'&&state.ammo?.staffCharges<state.ammo.staffMax){state.ammoRecovery=(Number(state.ammoRecovery)||0)+dt;if(state.ammoRecovery>=6){state.ammo.staffCharges=Math.min(state.ammo.staffMax,state.ammo.staffCharges+1);state.ammoRecovery=0;}}
}
export function staminaPolicyFor(state){
  const cap=Math.max(1,Number(state?.staminaCap)||100),ratio=clamp((Number(state?.stamina)||0)/cap,0,1);
  if(ratio<.14)return{band:'critical',ratio,allowOffense:false,allowFinisher:false,tempoScale:.72,recoveryBias:1,guardBias:.36};
  if(ratio<.32)return{band:'low',ratio,allowOffense:true,allowFinisher:false,tempoScale:.86,recoveryBias:.65,guardBias:.2};
  if(ratio<.62)return{band:'steady',ratio,allowOffense:true,allowFinisher:true,tempoScale:.96,recoveryBias:.25,guardBias:.08};
  return{band:'fresh',ratio,allowOffense:true,allowFinisher:true,tempoScale:1.05,recoveryBias:0,guardBias:0};
}

