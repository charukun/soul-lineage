/** Canonical RINNE equipment values, moved unchanged from rebuild/domain.js. */
export const WEAPONS = Object.freeze({
  fist: { id:'fist', label:'素手', skill:'basic.fist', reach:1.05, stamina:5, power:8 },
  sword: { id:'sword', label:'片手剣', skill:'basic.sword', reach:1.45, stamina:9, power:13 },
  dagger: { id:'dagger', label:'短剣', skill:'basic.dagger', reach:1.0, stamina:6, power:10 },
  great: { id:'great', label:'大剣', skill:'basic.great', reach:1.7, stamina:16, power:20 },
  spear: { id:'spear', label:'槍', skill:'basic.spear', reach:2.15, stamina:11, power:15 },
  axe: { id:'axe', label:'戦斧', skill:'basic.axe', reach:1.45, stamina:14, power:18 },
  staff: { id:'staff', label:'杖', skill:'basic.staff', reach:1.75, stamina:10, power:12 },
});
export const ARMORS = Object.freeze({
  cloth: { id:'cloth', label:'服', guard:0, staminaScale:1 },
  light: { id:'light', label:'軽鎧', guard:.15, staminaScale:.94 },
  heavy: { id:'heavy', label:'重鎧', guard:.28, staminaScale:.84 },
});
