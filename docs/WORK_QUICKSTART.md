# 実装WORKのクイックスタート

詳細規則をここへ複製しない。通常実装の正本は [`DEVELOPMENT.md`](DEVELOPMENT.md)、資料の入口は [`README.md`](README.md)。

```sh
git fetch origin
git switch -c feat/my-change origin/develop
# 意味のある最初の差分をpushしてdevelop向けDraft PRを作る
npm ci
# 実装・commit後
node scripts/validate.mjs fast origin/develop HEAD
npm run push:route -- origin/develop HEAD
```

実装と必要な高速検証が完了したら push → Ready for review → `READY_FOR_INTEGRATION` で終了する。CI / browser / DEV 公開の完了を watch・sleep・polling しない。

GitHub 搬送は通常 git → 接続済み GitHub API → 同じ branch の既存 Codespaces + 通常 git。容量・Base64・payload 上限で大きな binary を connector へ分割再送しない。詳細は [`MOBILE_HYBRID_DEVELOPMENT.md`](MOBILE_HYBRID_DEVELOPMENT.md)。

main / Production は明示許可時のみ変更し、品質 gate を弱めない。
