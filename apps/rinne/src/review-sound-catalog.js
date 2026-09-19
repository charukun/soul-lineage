import {selectTracks} from '@soul/audio';
import {audioURLs} from '@soul/audio/urls';
import {combatSfxURLs} from '@soul/audio/sfx-urls';

const sfx=Object.freeze([
  Object.freeze({id:'sfx-draw-blade',kind:'sfx',title:'抜刀',category:'武器',scene:'抜刀・構え',url:combatSfxURLs.drawBlade,source:'combatSfxURLs.drawBlade',description:'刀身を抜く動作に使う実ファイルの戦闘SE。'}),
  Object.freeze({id:'sfx-slash-a',kind:'sfx',title:'斬撃 A',category:'攻撃',scene:'斬撃・風切り',url:combatSfxURLs.slashA,source:'combatSfxURLs.slashA',description:'斬撃時に交互再生される実ファイルの戦闘SE。'}),
  Object.freeze({id:'sfx-slash-b',kind:'sfx',title:'斬撃 B',category:'攻撃',scene:'斬撃・風切り',url:combatSfxURLs.slashB,source:'combatSfxURLs.slashB',description:'斬撃時に交互再生される実ファイルの戦闘SE。'})
]);
const bgm=selectTracks({game:'rinne'}).map(track=>Object.freeze({
  id:track.id,kind:'bgm',title:track.title,category:track.scene,scene:track.scene,bpm:track.bpm,
  duration:track.duration,loop:Boolean(track.loop),url:audioURLs[track.id],source:`audioURLs.${track.id}`,
  description:track.description,productionStatus:track.productionStatus,
  commercialClearance:track.commercialClearance,licenseStatus:track.licenseStatus
}));
export const RINNE_SOUND_REVIEW_LIBRARY=Object.freeze([...sfx,...bgm]);
const searchable=item=>[item.id,item.kind,item.title,item.category,item.scene,item.description,item.source].filter(Boolean).join(' ').toLocaleLowerCase('ja');
export function filterSoundReviewLibrary({kind='all',query=''}={}){
  const normalized=String(query).trim().toLocaleLowerCase('ja');
  return RINNE_SOUND_REVIEW_LIBRARY.filter(item=>(kind==='all'||item.kind===kind)&&(!normalized||searchable(item).includes(normalized)));
}
export function soundReviewCounts(){
  return Object.freeze({total:RINNE_SOUND_REVIEW_LIBRARY.length,bgm:RINNE_SOUND_REVIEW_LIBRARY.filter(item=>item.kind==='bgm').length,sfx:RINNE_SOUND_REVIEW_LIBRARY.filter(item=>item.kind==='sfx').length});
}
