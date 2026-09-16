# 実装 WORK のクイックスタート

詳細な規則は [`DEVELOPMENT.md`](DEVELOPMENT.md) が正本。この文書は入口だけを残す。

```sh
git fetch origin
git switch -c feat/my-change origin/develop
npm ci
# 変更後
node scripts/validate.mjs fast origin/develop HEAD
npm run push:route -- origin/develop HEAD
```

通常のコード変更は、コード修正前に作業 branch を push して develop 向け Draft PR を作る。実装と必要な高速検証が完了したら push、Ready for review、`READY_FOR_INTEGRATION` で終了する。CI / browser / DEV 公開の完了待ちや polling はしない。

push 経路、PR 本文契約、Draft / Ready 条件、例外は [`DEVELOPMENT.md`](DEVELOPMENT.md) を参照する。main / Production は明示許可時のみ変更し、品質 gate は弱めない。
