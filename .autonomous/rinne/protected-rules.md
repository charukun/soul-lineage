# 百年転生固有の保護

共通 protected rules に加え、`docs/rinne/MAIN_GAME.md`、`docs/rinne/JOHAKYU_BATTLE_PLAN.md`、現在の `apps/rinne/src/rebuild/` を正本にする。

- 人生は0歳開始、60秒/年、100歳で生涯終了。世界速度1/5/10/20倍は世界時計だけへ作用し、移動・戦闘・生活行動の実秒へ倍率を掛けない。
- 武具は7歳、遠征は15歳、出航は5世界年ごと、生活行動は8実秒という現行契約を、別themeのついでに変更しない。
- 転生で年齢・体力・傷・装備・所持品・序破急/心得/構え・生涯経験を基礎状態へ戻し、一族記録と実際に帰還して刻んだ故郷だけを保持する。
- 戦闘は既存Tidebreak入力・自動戦闘を尊重する。通常攻撃ボタン、反射神経前提の回避、QTEを自律改善の都合で追加しない。
- 序破急、意識、六部位、スタミナ、技、装備の権威をpresentationへ移さない。同一命中・被弾・報酬を二重適用しない。
- 序破急バトルシステムのキャラ頭身、顔/輪郭、素材/配色、モーション接続、カメラ、暖冷光、影、霧、発光、音同期を無関係なロジック修正のついでに劣化させない。
- 装備変更はgame commandで年齢・生存・村内・非戦闘・近接・所持を再検証する。UIからcanonical stateを直書きしない。
- 保存はenvironment別のcanonical envelopeとWeb Locks/既存排他契約を維持する。破損保存を新規人生で無言上書きしない。演出途中のpose/VFX/audioを永続化しない。
- solo/sharedの時計権限と入力遮断を混同しない。UIがhost選出、epoch/revision、checkpoint authorityを所有しない。
- MURA配置は共有world契約から読み、RINNEから村の保存を上書きしない。entity ID/座標をUI都合で作り直さない。
- 血の系譜、一族問答、親子、抱っこ、生活、救助、閃き等の現存仕様は、関連themeでsourceとread-sideを確認せず削除・簡略化しない。
- MAIN_GAME文書と実装が食い違う場合、自律的に都合のよい側へ合わせない。差異を観測として記録し、そのiterationのthemeとして選ばれた場合だけEvidence付きで解消する。

調査基準はiteration開始時の最新developへ更新する。
