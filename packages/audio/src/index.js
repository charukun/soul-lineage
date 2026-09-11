import tracks from './catalog.json' with {type:'json'};
export const catalogVersion=2;
export const catalog=Object.freeze(Object.fromEntries(tracks.map(track=>[track.id,Object.freeze(track)])));
export function selectTracks({game='',query=''}={}){const q=query.trim().toLowerCase();return Object.values(catalog).filter(t=>(!game||t.game===game)&&(!q||`${t.id} ${t.title} ${t.scene} ${t.description}`.toLowerCase().includes(q)));}
