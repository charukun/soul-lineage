const COPY = Object.freeze({
  en: Object.freeze({
    labels: Object.freeze({ result: 'Result', impact: 'Impact', next: 'Next' }),
    stages: Object.freeze({
      READY_FOR_INTEGRATION: Object.freeze({
        badge: 'WAIT',
        headline: 'Waiting for develop integration',
        result: 'The PR is Ready for Integration.',
        impact: 'It is not merged to develop and is not published to DEV yet.',
        next: 'Integration owns CI/browser monitoring, merge, and DEV delivery.',
      }),
      INTEGRATED: Object.freeze({
        badge: 'INFO',
        headline: 'Merged to develop / DEV publication pending',
        result: 'The change is merged to develop.',
        impact: 'Public DEV delivery and verification are not confirmed yet.',
        next: 'Wait for DEV_DEPLOYED or FAILED.',
      }),
      DEV_DEPLOYED: Object.freeze({
        badge: 'OK',
        headline: 'DEV published and verified',
        result: 'The current develop snapshot is published to DEV.',
        impact: 'HTTP/source and focused browser verification passed.',
        next: 'No action is required.',
      }),
      FAILED: Object.freeze({
        badge: 'WARN',
        headline: 'Problem detected',
        result: 'A verification or delivery problem was detected.',
        impact: 'Do not treat the affected state as successfully delivered.',
        next: 'Check the reason and repair state below.',
      }),
      BROWSER_VERIFIED: Object.freeze({
        badge: 'OK',
        headline: 'Browser verification passed',
        result: 'Browser verification passed for the tested snapshot.',
        impact: 'The browser result is healthy for this verification scope.',
        next: 'Continue with the owning Integration state.',
      }),
    }),
  }),
  ja: Object.freeze({
    labels: Object.freeze({ result: '結果', impact: '影響', next: '次' }),
    stages: Object.freeze({
      READY_FOR_INTEGRATION: Object.freeze({
        badge: 'WAIT',
        headline: 'develop反映待ち',
        result: 'PRはIntegrationへ渡せるReady状態です。',
        impact: 'まだdevelopにも公開DEVにも反映されていません。',
        next: 'IntegrationがCI/ブラウザ確認、マージ、DEV反映を継続します。',
      }),
      INTEGRATED: Object.freeze({
        badge: 'INFO',
        headline: 'developへ統合済み / DEV公開は未確認',
        result: '変更はdevelopへマージ済みです。',
        impact: '公開DEVへの反映・検証完了はまだ確認されていません。',
        next: 'DEV_DEPLOYED または FAILED の通知を確認してください。',
      }),
      DEV_DEPLOYED: Object.freeze({
        badge: 'OK',
        headline: 'DEV反映・検証済み',
        result: '現在のdevelopスナップショットは公開DEVへ反映済みです。',
        impact: 'HTTP/sourceとfocused browser verificationに成功しています。',
        next: '対応不要です。',
      }),
      FAILED: Object.freeze({
        badge: 'WARN',
        headline: '問題を検出',
        result: '検証または配信で問題が検出されました。',
        impact: '対象状態を正常反映済みとして扱わないでください。',
        next: '下記の理由と修復状態を確認してください。',
      }),
      BROWSER_VERIFIED: Object.freeze({
        badge: 'OK',
        headline: 'ブラウザ検証成功',
        result: '対象スナップショットのブラウザ検証に成功しました。',
        impact: 'この検証範囲のブラウザ状態は正常です。',
        next: '現在のIntegration状態に従って処理を継続します。',
      }),
    }),
  }),
});

export const NOTIFICATION_STAGES = Object.freeze(Object.keys(COPY.en.stages));

export function normalizeNotificationLocale(value = 'en') {
  const language = String(value || 'en').trim().toLowerCase().replaceAll('_', '-').split('-')[0];
  return language === 'ja' ? 'ja' : 'en';
}

function presentation(stage, locale = 'en') {
  const language = normalizeNotificationLocale(locale);
  const value = COPY[language].stages[stage];
  if (!value) throw new Error(`UNKNOWN_NOTIFICATION_STAGE:${stage}`);
  return { language, labels: COPY[language].labels, ...value };
}

export function notificationHeadline(stage, locale = 'en') {
  const value = presentation(stage, locale);
  return `[${value.badge}][${stage}] ${value.headline}`;
}

export function notificationTitle(stage) {
  const value = presentation(stage, 'en');
  return `RINNE [${value.badge}] ${stage}`;
}

export function lifecycleMessage(stage, { locale = 'en', result, impact, next, lines = [] } = {}) {
  const value = presentation(stage, locale);
  return [
    notificationHeadline(stage, value.language),
    stage,
    `${value.labels.result}: ${result || value.result}`,
    `${value.labels.impact}: ${impact || value.impact}`,
    `${value.labels.next}: ${next || value.next}`,
    ...lines.filter(Boolean),
  ].join('\n');
}
