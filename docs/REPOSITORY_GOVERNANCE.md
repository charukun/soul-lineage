# Repository Governance

GitHubを実装の正本として扱う以上、Repository内のIntegration規則だけでなく、GitHub側のbranch protection / rulesetも防壁として扱う。

## 必須状態

- `develop`: GitHub上でprotectedであること。通常実装はPR → Ready → Integration経路を通し、直接pushを通常運用にしない。
- `main`: GitHub上でprotectedであること。Production昇格は明示的に許可された経路だけで行い、通常のdevelop Integrationから変更しない。

Repository側では `scripts/repository-governance-audit.mjs` がGitHubのbranch metadataを再取得し、各branch headへ `governance/branch-protection` statusを記録する。

- protected=true: success
- protected=false: failure
- API取得不能: audit failure。保護済みとは推定しない

このstatusは**保護そのものではない**。GitHub Administration設定が未適用ならコードやCIだけで代替したと主張しない。実際のbranch protection / rulesetはGitHub RepositoryのAdministration権限で適用する。

## Integrationとの関係

この監査は既存のexact-head CI、review、hold、Depends-On、browser gate、develop baseline、merge直前再確認を置き換えない。`governance/branch-protection` は運用上の外部防壁の状態表示であり、PRのコード検証statusを捏造しない。

Integration/Rescueのtrusted control planeから定期的に監査し、設定が外れた場合は最新develop/main headへfailureを残す。main / Productionのsourceを変更する処理は含まない。

## 現在未保護の場合

Repository APIが `protected: false` を返す間は「GitHubレベルでも強制済み」と報告してはいけない。Administration書き込み権限を持つ経路で保護を適用し、次回監査で両branchがsuccessになることを確認する。
