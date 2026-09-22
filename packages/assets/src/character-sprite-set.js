// Renderer-independent interchange contract. Imported approval is never trusted.
export const SPRITE_SET_SCHEMA = 'rinne.character-sprite-set/v1';
export const SPRITE_SET_BUNDLE_SCHEMA = 'rinne.character-sprite-bundle/v1';
export const SPRITE_SET_DIRECTIONS = Object.freeze(['front', 'frontRight', 'right', 'backRight', 'back', 'backLeft', 'left', 'frontLeft']);
export const SPRITE_SET_CORE = Object.freeze(['idle', 'walk', 'run', 'turn', 'attack', 'hit', 'talk', 'pickup', 'rest']);
export const SPRITE_SET_PARKOUR = Object.freeze(['jump', 'fall', 'vault', 'climb']);
export const SPRITE_SET_ACTIONS = Object.freeze([...SPRITE_SET_CORE, ...SPRITE_SET_PARKOUR]);
export const SPRITE_SET_LIMITS = Object.freeze({assets:32, assetBytes:8*1024*1024, totalBytes:32*1024*1024, bundleBytes:46*1024*1024, edge:4096, pixels:16777216, manifestBytes:1024*1024});
const LOOP_ACTIONS = new Set(['idle', 'walk', 'run', 'talk', 'rest', 'fall', 'climb']);
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const finite = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
const hash = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const name = v => typeof v === 'string' && /^[a-zA-Z][a-zA-Z0-9_.-]{0,95}$/.test(v) && !['constructor','prototype','__proto__'].includes(v);
const vec = (v, n, min, max) => Array.isArray(v) && v.length === n && v.every(x => finite(x,min,max));
const requireValue = (ok, message) => { if (!ok) throw new Error('Sprite Set: ' + message); };
export function spriteSetFilePath(value) {
  requireValue(typeof value === 'string' && value.length <= 200 && value.split('/').every(part => /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(part) && part !== '..') && /\.png$/i.test(value), 'PNGの相対パスが不正です');
  return value;
}
export function spriteSetLoop(clip, action) {
  return clip.loop ?? (clip.oneShot === undefined ? LOOP_ACTIONS.has(action) : !clip.oneShot);
}
export function assertCharacterSpriteSet(m, {playable = false} = {}) {
  requireValue(record(m) && m.schema === SPRITE_SET_SCHEMA, 'schemaが一致しません');
  requireValue(name(m.id) && typeof m.label === 'string' && m.label.length > 0 && m.label.length <= 120 && integer(m.revision,1,1000000), '識別情報が不正です');
  requireValue(['local-draft','approved'].includes(m.stage), 'stageが不正です');
  requireValue(Array.isArray(m.directions) && JSON.stringify(m.directions) === JSON.stringify(SPRITE_SET_DIRECTIONS), '8方向の順序が不正です');
  const r = m.render;
  requireValue(record(r) && vec(r.pivot,2,0,1) && finite(r.worldHeight,.2,12) && Array.isArray(r.frameSize) && r.frameSize.length===2 && r.frameSize.every(v=>integer(v,8,1024)), '共通pivot/高さ/フレーム寸法が不正です');
  if (r.shadowAnchor !== undefined) requireValue(vec(r.shadowAnchor,3,-12,12), 'shadowAnchorが不正です');
  if (r.shadowRadius !== undefined) requireValue(finite(r.shadowRadius,.02,4), 'shadowRadiusが不正です');
  if (r.occlusionCategory !== undefined) requireValue(name(r.occlusionCategory), 'occlusionCategoryが不正です');
  const p=m.provenance;
  requireValue(record(p) && p.schemaVersion===1 && hash(p.originalSourceSha256) && typeof p.author==='string' && p.author.length<=200 && typeof p.license==='string' && p.license.length<=200 && ['unknown','verified'].includes(p.rightsState) && Array.isArray(p.derivedProcessing) && p.derivedProcessing.length<=32 && p.derivedProcessing.every(s=>typeof s==='string'&&s.length<=500), '出典/派生履歴が不正です');
  requireValue(record(m.approval) && typeof m.approval.productionApproved==='boolean', '承認情報が必要です');
  requireValue(m.stage==='approved' ? (m.approval.productionApproved && p.rightsState==='verified' && typeof m.approval.receipt==='string' && m.approval.receipt.length>0) : m.approval.productionApproved===false, 'draftと本番承認が矛盾しています');
  requireValue(record(m.assets) && Object.keys(m.assets).length>0 && Object.keys(m.assets).length<=SPRITE_SET_LIMITS.assets, '素材数が不正です');
  let bytes=0,pixels=0; const files=new Set();
  for (const [id,a] of Object.entries(m.assets)) {
    requireValue(name(id) && record(a), '素材IDが不正です'); spriteSetFilePath(a.file);
    requireValue(!files.has(a.file),'素材パスが重複しています');files.add(a.file);
    requireValue(a.mediaType==='image/png' && a.hasTransparency===true && hash(a.sha256) && integer(a.byteLength,1,SPRITE_SET_LIMITS.assetBytes), '透過PNG/hash/容量が不正です');
    requireValue(integer(a.width,8,SPRITE_SET_LIMITS.edge) && integer(a.height,8,SPRITE_SET_LIMITS.edge), '画像寸法が不正です');
    requireValue(record(a.provenance) && hash(a.provenance.originalSourceSha256) && a.provenance.importedFileSha256===a.sha256 && Array.isArray(a.provenance.processing) && a.provenance.processing.length<=32 && a.provenance.processing.every(s=>typeof s==='string'&&s.length<=500), '画像の来歴が不正です');
    bytes+=a.byteLength;pixels+=a.width*a.height;
  }
  requireValue(bytes<=SPRITE_SET_LIMITS.totalBytes && pixels<=SPRITE_SET_LIMITS.pixels,'素材の合計容量/復号ピクセルが上限を超えています');
  requireValue(record(m.actions) && Object.keys(m.actions).length>0 && Object.keys(m.actions).length<=64,'action setが不正です');
  for (const [action,c] of Object.entries(m.actions)) {
    requireValue(name(action) && record(c) && Object.hasOwn(m.assets,c.asset),'actionの画像参照が不正です');
    const a=m.assets[c.asset];
    requireValue(c.rows===8 && integer(c.columns,1,64) && finite(c.fps,.1,60) && a.width===r.frameSize[0]*c.columns && a.height===r.frameSize[1]*8,'8行・等サイズフレームの規約に違反しています');
    requireValue(JSON.stringify(c.directionOrder)===JSON.stringify(SPRITE_SET_DIRECTIONS),'actionの方向順序が不正です');
    requireValue(c.loop===undefined || typeof c.loop==='boolean','loopが不正です');
    requireValue(c.oneShot===undefined || typeof c.oneShot==='boolean','oneShotが不正です');
    requireValue(c.loop===undefined || c.oneShot===undefined || c.loop!==c.oneShot,'loopとoneShotが矛盾しています');
    if(c.pivot!==undefined)requireValue(vec(c.pivot,2,0,1),'action pivotが不正です');
    if(c.rootOffset!==undefined)requireValue(vec(c.rootOffset,3,-12,12),'rootOffsetが不正です');
    if(c.travelHint!==undefined)requireValue(vec(c.travelHint,3,-30,30),'travelHintが不正です');
    if(c.events!==undefined)requireValue(Array.isArray(c.events)&&c.events.length<=64&&c.events.every(e=>record(e)&&integer(e.frame,0,c.columns-1)&&name(e.name)), 'event frameが不正です');
    // Optional projected anchors: direction -> one entry per frame -> socket -> [u,v,depth/worldHeight].
    if(c.anchors!==undefined){
      requireValue(record(c.anchors),'anchorsが不正です');
      for(const [d,frames] of Object.entries(c.anchors)){
        requireValue(SPRITE_SET_DIRECTIONS.includes(d)&&Array.isArray(frames)&&frames.length===c.columns,'anchor方向/フレーム数が不正です');
        for(const anchors of frames)requireValue(record(anchors)&&Object.keys(anchors).length<=16&&Object.entries(anchors).every(([k,v])=>name(k)&&vec(v,3,-2,2)),'anchor座標が不正です');
      }
    }
  }
  if(m.anchors!==undefined)requireValue(record(m.anchors)&&Object.keys(m.anchors).length<=16&&Object.entries(m.anchors).every(([k,v])=>name(k)&&vec(v,3,-2,2)),'共通anchorが不正です');
  if(m.weaponVariants!==undefined){
    requireValue(record(m.weaponVariants)&&Object.keys(m.weaponVariants).length<=32,'武器variantが不正です');
    for(const [weapon,variants] of Object.entries(m.weaponVariants))requireValue(name(weapon)&&record(variants)&&Object.entries(variants).every(([a,target])=>name(a)&&Object.hasOwn(m.actions,target)),'武器action参照が不正です');
  }
  if(playable){
    const missing=SPRITE_SET_CORE.filter(a=>!Object.hasOwn(m.actions,a));
    requireValue(!missing.length,'core action不足: '+missing.join(', '));
    requireValue(m.actions.jump&&m.actions.fall&&(m.actions.vault||m.actions.climb),'starter parkourにはjump/fallとvaultまたはclimbが必要です');
  }
  return m;
}
export const wrapSpriteAngle = value => Math.atan2(Math.sin(value),Math.cos(value));
export function resolveSpriteSetDirection(actorYaw,cameraYaw,previous=null,hysteresis=.09){
  requireValue(Number.isFinite(actorYaw)&&Number.isFinite(cameraYaw)&&finite(hysteresis,0,Math.PI/8),'view入力が不正です');
  const angle=wrapSpriteAngle(cameraYaw-actorYaw),step=Math.PI/4,index=SPRITE_SET_DIRECTIONS.indexOf(previous);
  if(index>=0&&Math.abs(wrapSpriteAngle(angle-index*step))<=step/2+hysteresis)return previous;
  return SPRITE_SET_DIRECTIONS[((Math.floor(angle/step+.5)%8)+8)%8];
}
export function spriteSetGrounding(m,action){
  const pivot=m.actions[action].pivot||m.render.pivot,h=m.render.worldHeight,w=h*m.render.frameSize[0]/m.render.frameSize[1];
  return {width:w,height:h,x:(.5-pivot[0])*w,y:(pivot[1]-.5)*h,pivot};
}
export function spriteSetUV(m,action,direction,frame){
  const c=m.actions[action],a=m.assets[c.asset],row=SPRITE_SET_DIRECTIONS.indexOf(direction);
  requireValue(row>=0&&integer(frame,0,c.columns-1),'表示frame/directionが不正です');
  return {u0:(frame*m.render.frameSize[0]+.5)/a.width,u1:((frame+1)*m.render.frameSize[0]-.5)/a.width,v0:1-((row+1)*m.render.frameSize[1]-.5)/a.height,v1:1-(row*m.render.frameSize[1]+.5)/a.height};
}
