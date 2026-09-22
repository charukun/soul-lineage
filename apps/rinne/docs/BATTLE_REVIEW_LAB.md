# 実戦 Visual Review Lab

`apps/rinne/review-battle.html` は、実ゲームと同じ `RaidHost` / Tidebreak 戦闘状態を人間が短時間で比較確認するためのレビュー画面とする。

## 受入条件

- 戦闘ロジックをレビュー用に複製しない。`RaidHost` が返す同じ戦闘スナップショットを表示する。
- 序破急の現在値は Tidebreak actor snapshot の `slot` (`jo` / `ha` / `kyu`) を正本とし、疑似タイマーで再計算しない。
- 序破急の状態機構は共通とし、百年転生と喰滅廻遊では見た目だけを切り替える。UIスキン切替で戦闘をリセットしない。
- 自動ループをON/OFFでき、ON時は戦闘終了後に同じ条件で次の戦闘へ進む。
- カメラ追従をON/OFFでき、ON時は両者の中点と広がりを追い、戦闘中の接触を見失わない。OFF時は固定レビューカメラとする。
- 1v1の剣戟は、攻撃clipと受けclipの実接触フレームを同期し、表示中のblade軌道から受け流し方向を決める。弾かれ側は下半身を含む短い崩れを経てretreatへ連続遷移し、その開いた線へcounterする。判定・HP・序破急のauthorityは変更しない。
- 序→破→急の攻勢は、通常guard・弱いparryでは技ごとに間合いを取り直さず連続する。共有Exchange Policyがstrong parry / deep hit / major miss / execution blocked / 急完了を観測した時だけ、reversalまたは読み合いへ戻す。Review専用の別状態機械で本編と異なる攻防規則を作らない。
- 序破急HUDは主人公視点のExchangeに追従する。主人公がinitiativeを持つpressure中だけ序/破/急を点灯し、守勢・読み合いでは左端の間合い波形、主人公自身の急完遂だけ右端の残心を点灯する。相手の完了・strong parry・counter/reversal遷移は左波形とする。cursor phaseだけで攻勢表示を残さない。
- 対戦相手は人型キャラクターへ角などを足した疑似怪物ではなく、実モンスターGLBを表示する。1v3の追加個体もモンスターモデルで統一する。
- モデル表示の差し替えは戦闘ロジック・HP・攻撃タイミングを変更しない。
- 閃いた技はその瞬間に主人公が使用していた序/破/急スロットへセットし、そのレビューセッション中は同一技を再度「新規習得」しない。候補は共有の因縁閃き技カタログから、装備武器・現在phase・1v1/1v3状況・未習得を条件に選ぶ。
- 閃き演出は「閃く → カメラアクション → 間合いを取る → 敵が怯む → 技名表示/VFX/SFX → 技発動」の順序を持ち、短い即時ポップアップだけで終わらせない。
- 通常戦闘の構図は主人公を画面左下側、敵を右上側へ寄せ、閃き中は専用カメラへ遷移する。
- モバイル幅でも、戦闘キャンバス、序破急UI、主要操作が同時に確認できる。
- `/battle2` の画面表示バージョンは人間向けSemVerを正本とし、Git commit SHAは表示しない。SHAは内部のsource/evidence照合にのみ保持する。
- 公開 Visual Review bundle は `/` と `/review.html` のどちらからでも同じランチャーへ到達でき、戻る導線や既存URLから `review.html` を開いても 404 にしない。

この文書はレビュー画面の受入条件のみを定義し、本編の戦闘仕様そのものを変更しない。

## /battle2 2.2.0 Exchange受入

共有Policyで反転と通常開始を分け、次の通常攻勢は旧reaction/action後処理の終了後に序から始める。段の合間も同じ攻勢のphaseを保持する。攻撃clip/受けclipの表示contact syncは維持し、canonical event triggerの`.46`は変更しない。

通常レビューに時刻固定のsave/restoreを注入しない（これが攻勢の途中でcursorを巻き戻していた）。保存テストは明示的な`checkpointSeconds` fixtureで行い、復帰時はREAD・空のaction・序cursorとする。`actorOverrides`はdeterministicなstamina/身体境界のテスト用であり、通常画面はcanonical既定条件を用いる。

focused受入: shared Exchange Policy、Tidebreak実接触/recoil/counter/deferred restart、reviewの全攻勢/HUD/secondary接触/能力拒否、実life保存境界をそれぞれ検証する。描画観察はこの因果的検証を代替しない。


`battle2 2.2.1` は共有AI intentにより守勢を実際の受け/spacingへ接続する。決定論fixtureは必要な開始間合い・stamina・stale cursorを明示する。呼吸の検証はbounded traceの末尾だけでなく各frameの記録を集約し、接近/残心/再接近の証拠を失わない。弱いmissは引き続き実damageなし、major missだけが攻勢を切る。
