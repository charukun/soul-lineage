/** Small detached view for in-game advice; no storage, renderer or metrics reads. */
export function huntPresentationSnapshot({mode,paused,game,profile}){
 if(!game)return null;
 return{mode,paused,village:game.village.id,finished:game.finished,eaten:game.eaten,time:game.time,
  player:{x:game.player.x,z:game.player.z,autoRoam:game.player.autoRoam},
  profile:{unlocked:[...(profile.unlocked||[])],visits:Object.fromEntries(Object.entries(profile.visits||{}).map(([id,row])=>[id,{status:row.status,eaten:row.eaten}]))},
  npcs:game.village.npcs.map(n=>({id:n.id,role:n.role,x:n.x,z:n.z,dead:n.dead,eaten:n.eaten})),
  devouring:!!game.devour,combat:game.fight?{active:true}:null,
 };
}

export function readHuntPresentation(api){
 return(api?.presentationSnapshot||api?.snapshot)?.call(api)||null;
}
