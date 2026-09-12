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

実装WORKはReady化・結果報告で終了。CI完了の同期待機・繰り返しポーリングは禁止。CI監視と失敗時の修正差し戻しはIntegrationが担当。最終developの影響範囲高速検証・DEV公開・HTTP/source確認はIntegrationが担当し、重い検証は必要時に分離します。未完了・未決定はdraftまたはintegration:hold。
