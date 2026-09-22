# Character Golden Baselines

Golden baselineは手書きの「良さそうな値」ではありません。`@soul/characters` の `createCharacterGoldenBaseline()` が、同じcharacter production manifestを`RUNTIME_READY`まで再評価し、`POLISH`の明示`visualApproval=approved`とruntime evidenceを確認した場合だけ生成します。

Goldenは外部GitHub referenceと役割を分けます。

- External reference: 固定commit・license・evidenceを持つ技法/造形の比較材料。外部資産を内部正解へ自動昇格しません。
- Production manifest: Repository内assetが現在どの制作stageまで証明済みかの正本。
- Golden baseline: RUNTIME_READY済み内部assetの実測値を、同じ`app / age band / body archetype / role / render tier`の後続候補比較に再利用する診断基準。

Golden比較はtriangles、draw calls、texture memory、desktop/mobile p95の差分を返しますが、数値だけでvisual approvalを付与しません。見た目の承認は引き続き人間のVisual Reviewが正本です。

永続化する場合も、対応するproduction manifestとasset hashを必ず保持し、Coverage Matrixへ渡すproduction候補には明示presentation selector（apps / ageBands / bodyArchetypes / roles / renderTiers）を付けます。selectorのないmanifestを全アプリ対応と推測しません。
