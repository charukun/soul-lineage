import tracks from './catalog.json' with {type:'json'};
export const catalogVersion=2;
export const catalog=Object.freeze(Object.fromEntries(tracks.map(track=>[track.id,Object.freeze(track)])));
export function selectTracks({game='',query=''}={}){const q=query.trim().toLowerCase();return Object.values(catalog).filter(t=>(!game||t.game===game)&&(!q||`${t.id} ${t.title} ${t.scene} ${t.description}`.toLowerCase().includes(q)));}
export const threeWorlds150=Object.freeze({id:'rinne-three-worlds-150-v2',title:'三界の調べ',label:'三界の調べ150',totalTracks:Object.keys(catalog).length,groups:Object.freeze({rinne:48,village:48,demon:48,shared:6}),preferredFormat:'ogg'});
