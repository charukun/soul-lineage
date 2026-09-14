import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

export const CODE_HEALTH_AUTO_MARKER = 'RINNE-Code-Health: auto-refactor';

function slugFor(path) {
  return basename(path).replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 36) || 'hotspot';
}

export function buildDispatchArtifacts(report) {
  const candidate = report?.candidates?.find(item => item.actionable);
  if (!candidate) throw new Error('code health report has no actionable candidate');
  const relatedDuplicates = (report.duplicateGroups || []).filter(group =>
    group.occurrences.some(item => item.path === candidate.path)).slice(0, 4);
  const relatedPaths = [...new Set(relatedDuplicates.flatMap(group => group.occurrences.map(item => item.path)).filter(path => path !== candidate.path))].slice(0, 8);
  const evidence = [
    `score ${candidate.score}/100`,
    `${candidate.loc} LOC`,
    candidate.maxFunctionSpan ? `longest function ≈${candidate.maxFunctionSpan} lines` : null,
    candidate.duplicateLines ? `${candidate.duplicateLines} duplicate-covered lines` : null,
    `${candidate.decisionDensity} decisions/100 LOC`,
  ].filter(Boolean).join(', ');
  const title = `Code Health: ${candidate.path}を分割・整理`;
  const detail = `肥大化ホットスポットを挙動維持のまま小さな責務へ分離し、重複と複雑化を減らす`;
  const request = `最新developとRepositoryルールを正本として、Code Healthが検出した次の1ホットスポットだけを安全にリファクタしてください。\n\n` +
    `Primary hotspot: \`${candidate.path}\`\nEvidence: ${evidence}\n` +
    (relatedPaths.length ? `Related duplicate locations: ${relatedPaths.map(path => `\`${path}\``).join(', ')}\n` : '') +
    `\n目的は行数だけを移動することではなく、責務分離・重複除去・既存共有packageの再利用で構造的負債を減らすことです。` +
    `公開API、ゲーム挙動、保存形式、ネットワーク権限、描画/入力タイミングを変更しないでください。` +
    `テストやブラウザassertion、Integration gateを削除・緩和してはいけません。` +
    `新しい巨大ファイルへ丸ごと移すだけの変更は禁止です。必要なfocused regression testを追加・維持し、変更対象をこのhotspotと直接依存だけに限定してください。\n\n` +
    `まず既存のconsumer/export/責務境界を確認し、意味的に安全な分割ができる場合のみ実装してください。` +
    `安全に改善できない、または既に解消済みなら人工的な差分を作らずno-opで終了してください。`;
  const body = `${title}\n${detail}\n\n${CODE_HEALTH_AUTO_MARKER}\nRINNE-Dispatch: implementation\n\n## Request\n${request}\n\n## Code Health evidence\n` +
    `- generated: ${report.generatedAt}\n- hotspot score: ${candidate.score}\n- reasons: ${(candidate.reasons || []).join('; ') || 'composite score'}\n`;
  const marker = `# Autonomous Code Health refactor\n\n${candidate.path} was selected by the repository Code Health audit.\n\nEvidence: ${evidence}\n\nThis marker is temporary bootstrap state and must be removed by RINNE Dispatch before Ready for review.\n`;
  return { slug: slugFor(candidate.path), title, detail, request, body, marker, candidate };
}

async function main() {
  const [reportPath, markerPath, bodyPath] = process.argv.slice(2);
  if (!reportPath || !markerPath || !bodyPath) throw new Error('usage: node scripts/code-health-dispatch.mjs <report.json> <marker.md> <pr-body.md>');
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  const artifacts = buildDispatchArtifacts(report);
  await writeFile(markerPath, artifacts.marker, 'utf8');
  await writeFile(bodyPath, artifacts.body, 'utf8');
  process.stdout.write(`${JSON.stringify({ slug: artifacts.slug, title: artifacts.title, path: artifacts.candidate.path })}\n`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
