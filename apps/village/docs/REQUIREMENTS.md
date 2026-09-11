# 添付成果物の19項目と統合先

| 依頼 | 実装と確認場所 |
|---|---|
| 無操作で村ステータス | `src/web/main.js:updateIdle`。約8秒の実待機をブラウザで検証。触ると退避。 |
| 関連地形による配置制限 | `src/game/terrain.js:terrainError`、`src/game/core.js:canPlace`。配置と移動、実際の配置エラー表示を確認。 |
| ゆるい住まい上限 | `src/game/core.js:population`。食事・警備＋先行寝床余裕。既存住人を追放しない。 |
| 野生動物と警備施設 | `src/game/simulation.js:updateWildlife/guardStep`、詰所・見張り台・駐屯所。 |
| 初期チュートリアルバッジ | `src/game/catalog.js:TUTORIAL`、`src/web/main.js:updateTutorial`。5手順・タップ案内・閉じる・保存。 |
| 保有資材で建材違い | `src/game/catalog.js:recipe/materialOptions`。標準・木造・石造・土壁。実際の資源支払いと外壁色。 |
| 村長がNPCとして暮らす | `src/game/core.js:initial`。住まい・仕事・食事・散歩・自宅家具があるavatar-npc。 |
| 初期護衛1人と住まい | `guard-npc`アルド、`guardhome`。初期に両者を配置。 |
| 護衛そばで野生生物に殺されない | `src/game/simulation.js:hurt`。11m保護、極端な反復ダメージもテスト。 |
| 常設の定期モンスター襲撃 | `updateRaid`。初回猶予、45秒予告、反復、保存、終結。AIのみ。 |
| 人数に応じた襲撃 | `raidBudget`。開始時の人数を確定し敵数・能力を算出、途中参加で再計算しない。 |
| 防衛がないと移住が増えない | `population/safetyAt/arrive`。警備員の就労、生活圏への守り、設置物の控えめな効果。 |
| 一族専用邸宅 | `clanManor`、`src/game/bridge.js`。NPC入居拒否、定員・重複制御、ローカルデモ。本編通信は未接続。 |
| 資材消費で増築 | `src/game/core.js:upgrade`、`src/game/simulation.js:construction`。二重消費防止、継続保存、内装保持、3段階。 |
| 一族と住人のタップ詳細 | `src/web/view.js:pickPerson`、`src/web/main.js:personDialog`。体調・満腹・気分・住まい・仕事・近況・一族。 |
| 各施設の特性と資源 | `src/game/catalog.js:BUILDINGS`、`src/game/simulation.js:finish`。全施設にtrait。採集・加工と施設効能。 |
| 新資源獲得で解放 | `src/game/core.js:gain/discover`、`src/game/catalog.js:unlocked`。初回取得と保存。 |
| 利用可能まで非表示 | 未解放カードをDOMに作らない。残高0でも既知の資源による解放状態は保持。 |
| まったり観察が楽しい仕組み | 低速旋回、常時チルトシフト、生活行動、家具の自動配置、形成される道、短い会話、日誌、野うさぎ・鹿、護衛の付き添い・食事、人物追従、長めの襲撃間隔。 |

## 維持した仕様

連続配置とスワイプの向き、512m四方の村、同一シーン内の屋根カット、空き家・施設の室内編集、住人の家具、確認付き削除と内装込みの取り消し、5年周期の船、建材不要の8施設、既存施設・庭・室内家具を保持しています。v4の全配置物ID種別をv5で受け入れます。

## 完成範囲の区別

これは操作可能なローカル実装です。19項目のうち一族の「実プレイヤー接続」は、居住データ契約と明示的なローカルデモまでです。モンスタープレイヤーの実接続、本編の戦闘・時計・キャラクターとの統合、Production品質の資産セット、実機性能保証を含みません。
