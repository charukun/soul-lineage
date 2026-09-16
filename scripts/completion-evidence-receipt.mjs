// Informational receipt only: never grants merge, browser or DEV status authority.
// Execute from trusted develop, not the tested PR checkout.
export async function recordCompletionEvidence({ github, repo, number, head, runId, attempt = 1, conclusion, state, images, videos }) {
  const repository = `${repo.owner}/${repo.repo}`;
  if (!/^[a-f0-9]{40}$/.test(head || '') || !Number.isSafeInteger(number) || number < 1 ||
      !/^\d+$/.test(String(runId)) || !Number.isSafeInteger(Number(attempt)) || Number(attempt) < 1 ||
      !['success', 'failure', 'cancelled'].includes(conclusion)) throw new Error('INVALID_EVIDENCE_RECEIPT');
  const current = async () => {
    const { data: pr } = await github.rest.pulls.get({ ...repo, pull_number: number });
    return pr.head?.sha === head && pr.head?.repo?.full_name === repository && pr.base?.ref === 'develop'
      && ((!pr.draft && pr.state === 'open') || Boolean(pr.merged_at));
  };
  if (!await current()) return { skipped: 'stale-or-ineligible-pr' };
  const runUrl = `https://github.com/${repository}/actions/runs/${runId}`;
  const name = `pr-browser-${number}-${head}`;
  const { data } = await github.rest.actions.listWorkflowRunArtifacts({ ...repo, run_id: runId, per_page: 100 });
  const artifact = data.artifacts.find(item => item.name === name && !item.expired && item.size_in_bytes > 0);
  const count = value => /^\d{1,4}$/.test(String(value)) ? Number(value) : 0;
  const imageCount = count(images), videoCount = count(videos);
  const captured = Boolean(artifact && state === 'captured' && imageCount + videoCount > 0);
  const marker = `<!-- completion-evidence:${number}:${head}:`;
  let previous;
  for (let page = 1; page <= 3; page++) {
    const { data: comments } = await github.rest.issues.listComments({ ...repo, issue_number: number, per_page: 100, page });
    previous = comments.find(item => item.user?.login === 'github-actions[bot]' && item.body?.includes(marker));
    if (previous || comments.length < 100) break;
    if (page === 3) throw new Error('EVIDENCE_COMMENT_PAGE_LIMIT');
  }
  if (previous) {
    const version = previous.body.slice(previous.body.indexOf(marker) + marker.length).match(/^(\d+):(\d+) -->/);
    if (version && (BigInt(version[1]) > BigInt(runId) || (version[1] === String(runId) && Number(version[2]) > Number(attempt)))) return { skipped: 'newer-report-exists' };
  }
  if (!await current()) return { skipped: 'stale-or-ineligible-pr' };
  const result = conclusion === 'success' ? '成功' : conclusion === 'failure' ? '失敗（画像・動画は診断用）' : '中断';
  const artifactUrl = artifact ? `${runUrl}/artifacts/${artifact.id}` : null;
  const body = [
    `${marker}${runId}:${attempt} -->`,
    '## 確認画像・動画', '',
    `対象SHA: \`${head}\``,
    '環境: local PR preview / mobile 390×844。DEV公開画面の録画ではありません。',
    `確認: affected mobile/WebGL browser smoke ／ 結果: **${result}**`,
    captured ? `撮影済み: 画像 ${imageCount}件・動画 ${videoCount}件。` : '**エビデンス未取得**: 撮影・集計・保存のいずれかが未完了です。画像確認済みとは扱いません。', '',
    artifactUrl ? `[画像・動画を開くための成果物をダウンロード](${artifactUrl})` : '',
    artifactUrl ? `GitHubへのログインが必要です。ZIPを展開し、index.htmlで画像・動画を確認できます。保存期限: ${artifact.expires_at || 'runのArtifacts欄を参照'}。` : '',
    `[検証run・取得失敗の詳細](${runUrl})`, '',
    '確認範囲は記録されたシナリオのみ。依頼固有の操作・見た目の確認は、最終応答のエビデンスと併せて確認してください。',
    'Chat / WORKの最終報告では対象ファイルを取得し、代表画像を直接表示、または動画を添付します。',
    'これは証拠の所在を記録する報告です。merge / DEV公開 / 人間の目視承認を意味しません。',
  ].filter(Boolean).join('\n\n');
  if (!previous) await github.rest.issues.createComment({ ...repo, issue_number: number, body });
  else if (previous.body !== body) await github.rest.issues.updateComment({ ...repo, comment_id: previous.id, body });
  return { state: captured ? 'captured' : 'missing', artifactUrl, head };
}
