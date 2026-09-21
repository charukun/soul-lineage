export const REVIEW_PROBES=Object.freeze([
  {id:'characters',label:'キャラクター',detail:'形状・個体差・年齢・シルエット',tag:'MODEL'},
  {id:'motion',label:'モーション',detail:'姿勢・遷移・接触・再生',tag:'MOTION'},
  {id:'equipment',label:'装備',detail:'装着・干渉・輪郭・モデル差',tag:'EQUIP'},
  {id:'objects',label:'物体',detail:'小物・ワールド資産・尺度',tag:'OBJECT'},
  {id:'effects',label:'エフェクト',detail:'VFX・同期・視認性・負荷',tag:'VFX'},
  {id:'sounds',label:'サウンド',detail:'効果音・BGM・単独試聴',tag:'AUDIO'},
  {id:'battle',label:'戦闘演出',detail:'段・技・連・序破急・実演',tag:'BATTLE'},
  {id:'battle2',label:'序破急バトルシステム',detail:'百年転生へ段階統合する新戦闘基盤',tag:'BATTLE'},
  {id:'battlebk',label:'戦闘演出bk',detail:'戦闘演出2のバックアップ',tag:'BATTLE'},
].map(Object.freeze));

export const REVIEW_RUNTIME_PATHS=Object.freeze({
  motion:'review-motion',
  equipment:'review-assets',
  objects:'review-objects',
  effects:'review-effects',
  sounds:'review-sound',
  battle:'review-battle',
});

const currentHref=()=>globalThis.location?.href||'http://localhost/';

export function createReviewRoutes({rinneBase,charactersBase,locationHref=currentHref()}={}){
  const routes={};
  if(charactersBase)routes.characters=new URL(charactersBase,locationHref).href;
  if(rinneBase){
    const base=new URL(rinneBase,locationHref);
    for(const [id,path] of Object.entries(REVIEW_RUNTIME_PATHS))routes[id]=new URL(path,base).href;
  }
  return Object.freeze(routes);
}
