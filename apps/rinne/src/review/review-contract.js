/** Pure review contracts: no renderer or browser dependency. */
export const STAGES = Object.freeze(['stage-jo', 'stage-ha', 'stage-kyu']);
export const STAGE_LABELS = Object.freeze(['序', '破', '急']);

export function stagePrefix(id, selections) {
  const end = STAGES.indexOf(id);
  if (end < 0) throw new Error('不明な再生段階です');
  return STAGES.slice(0, end + 1).map((key, index) => {
    const name = selections[key];
    if (typeof name !== 'string' || !name.trim()) throw new Error(`${STAGE_LABELS[index]}のモーションを選択してください`);
    return name;
  });
}

export function sequenceDuration(clips) {
  return clips.reduce((total, clip) => {
    if (!clip || !Number.isFinite(clip.duration) || clip.duration <= 0) throw new Error('再生できる長さのモーションがありません');
    return total + clip.duration;
  }, 0);
}

/** Resolve the clip and local time from the authoritative, cumulative timeline. */
export function sequenceFrame(clips, time) {
  if (!clips.length) return null;
  let offset = 0;
  const position = Math.max(0, Number.isFinite(time) ? time : 0);
  for (let index = 0; index < clips.length; index++) {
    const duration = clips[index].duration;
    if (position < offset + duration || index === clips.length - 1) {
      return {index, offset, time: Math.min(duration, Math.max(0, position - offset)), duration};
    }
    offset += duration;
  }
}

export function isPostureMotion(kind, text) {
  const value = String(text);
  const undraw = /unsheath|unholster|抜刀|抜剣/i.test(value);
  const sheath = !undraw && /sheath|holster|unequip|納刀|納剣/i.test(value);
  if (kind === 'sheathe') return sheath;
  if (kind !== 'draw' || sheath) return false;
  if (undraw) return true;
  // Bow drawing, sword attacks and poses are not a sword draw animation.
  return !/bow|crossbow|gun|銃|弓|attack|slash|stance|pose|構え|居合/i.test(value)
    && /(?:^|[\s_/-])draw(?:$|[\s_/-])|(?:^|[\s_/-])equip(?:$|[\s_/-])/i.test(value);
}

export function reviewTemplate(context, {approved = false, note = ''} = {}) {
  return [
    '輪廻転焦 Visual Review Lab',
    `確認結果: ${approved ? '確認OK' : '要修正'}`,
    `対象タブ: ${context.tab || '不明'}`,
    `対象: ${context.target || '現在のモーション'}`,
    `対象モーション: ${context.motion || '静止比較'}`,
    `キャラクター: ${context.model || '未読込'}`,
    `Source: ${context.source || '未読込'}`,
    `Build: ${context.build || '不明'}`,
    `武器: ${context.weapon || 'なし'}`,
    `技構成: ${context.composition || '未設定'}`,
    `確認した再生範囲: ${context.sequence || '単体'}`,
    `再生中モーション: ${context.active || '静止比較'}`,
    `Time: ${context.time || '0.000s'} / ${context.duration || '0.000s'}`,
    `Speed: ${context.speed || '1'} / 反復: ${context.loop ? 'ON' : 'OFF'}`,
    `URL: ${context.url || ''}`,
    '',
    ...(approved ? ['【確認結果】', '上記対象を確認しました。修正不要です。'] : [
      '【気になる箇所・タイミング】', note, '',
      '【現在の見え方・問題点】', '', '',
      '【期待する見え方・修正してほしい内容】', '', '',
      '【補足・再現手順】', ''
    ])
  ].join('\n');
}
