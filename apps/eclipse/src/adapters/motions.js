/** Select real artist-authored clips. Missing required animation is a build/runtime error. */
const hero = {
 Idle: ['Sword_Idle','Sword_Block'], Idle_Combat: ['Sword_Idle','Sword_Block'],
 Running_A: ['Jog_Fwd_Loop','Walk_Carry_Loop'], Running_B: ['Sprint_Loop','Walk_Carry_Loop'],
 Walking_A: ['Walk_Loop','Walk_Carry_Loop'], Cheer: ['Yes'],
 Death_A: ['Death01','Hit_Knockback'], Spawn_Ground_Skeletons: ['Jump_Land','NinjaJump_Land'],
 Jump_Full_Short: ['NinjaJump_Start'],
 Spellcast_Raise: ['Sword_Regular_C'], Spellcast_Long: ['Sword_Regular_Combo'],
 Spellcast_Shoot: ['Sword_Regular_B'],
 '1H_Melee_Attack_Slice_Horizontal': ['Sword_Regular_A'],
 '1H_Melee_Attack_Slice_Diagonal': ['Sword_Regular_B'],
 '1H_Melee_Attack_Chop': ['Sword_Regular_C'],
 '2H_Melee_Attack_Chop': ['Sword_Regular_C'],
 '2H_Melee_Attack_Spin': ['Sword_Regular_Combo'],
};
const monster = {
 Idle: ['Idle','Flying'], Idle_Combat: ['Idle','Flying'],
 Running_A: ['Walk','Flying'], Running_B: ['Walk','Flying'], Walking_A: ['Walk','Flying'],
 Spawn_Ground_Skeletons: ['Jump','Flying','Idle'],
 Death_C_Skeletons: ['Death'], Death_A: ['Death'], Cheer: ['Dance','Flying','Idle'],
 Spellcast_Shoot: ['Bite_Front'], Spellcast_Raise: ['Bite_Front'], Spellcast_Long: ['Bite_Front'],
 '1H_Melee_Attack_Chop': ['Bite_InPlace','Bite_Front'],
 '1H_Melee_Attack_Slice_Diagonal': ['Bite_InPlace','Bite_Front'],
 '1H_Melee_Attack_Slice_Horizontal': ['Bite_InPlace','Bite_Front'],
 '2H_Melee_Attack_Chop': ['Bite_Front'],
 '2H_Melee_Attack_Spin': ['Bite_InPlace','Bite_Front'],
};
export function resolveMotion(isHero, clips, state) {
 const names=(isHero?hero:monster)[state] || [state];
 const name=names.find(n=>clips.has(n));
 if(!name) throw new Error(`Missing artist animation for ${isHero?'ranger':'monster'} ${state}: ${names.join(', ')}`);
 return name;
}
