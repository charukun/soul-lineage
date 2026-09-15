作業内容がひと目で分かる短いタイトル
変更・修正・追加する内容の簡潔な詳細

<!-- 上の2行を具体的な内容へ置換。先頭に空行・見出しを置かない。 -->

## 変更理由と挙動

## 影響範囲

- Apps / packages:
- 共有契約・他WORKとの関係:

Depends-On: none

## 高速検証

- 実行した検証と結果:
- 残るリスク・仕様判断:

## DEVでの確認

- AIが採用した仮定・可逆的な選択:
- 公開後に見てほしい画面・操作:
- 目視で調整したい点（任意の確認。公開前の承認待ちにはしない）:

## Integration handoff

- branch / commit SHA:
- Ready for review: 未完了（Ready時に更新）
- Worker結果: 未完了（完了時 `READY_FOR_INTEGRATION`）
- CI/browser監視担当: Integration

[実行ポリシー](../docs/RINNE_PROJECT_EXECUTION_POLICY.md)に従い、Ready化後はCIのRunning/Queued/Pendingを待たず結果を返して終了する。未完了・未解決の重大な契約/権限判断はdraftまたはintegration:hold。確定要件内の可逆的な細部はAIが決め、通常gateを通してDEV公開後のフィードバックで改善する。
