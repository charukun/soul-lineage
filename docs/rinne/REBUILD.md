# 輪廻転焦 Clean Rebuild

## 目的

`apps/rinne` を既存の巨大起動経路の延長ではなく、現在の輪廻転焦ゲーム仕様とRepository内の採用済み資産を正本にして再構築する。

この再構築は旧実装のコード移植を目的にしない。ゲーム仕様、共有world契約、採用済みasset provenance、保存境界だけを引き継ぎ、起動・描画・HUD・本編sessionを新しい小さなmodule群として作る。

## 正本として保持する仕様

- 0歳開始、60秒/年、90歳寿命。時間倍率1〜20倍は世界時計だけへ適用する。
- 7歳から武具、15歳から遠征。5世界年ごとの出港条件を保持する。
- 幼少期、村生活、生活経験、技の閃き、序破急、接触自動戦闘、負傷と救助、前線、帰還、死亡、記録、次代の出生を一つの人生loopとして扱う。
- 稽古用設定と本編進行を分離し、既存の技目録・序破急候補/比率・防・装備/モデル設定を生涯終了で破壊しない。
- MURAAAAAAAの地形・配置・建物catalogは `@soul/world/mura`、表示は `@soul/rendering/mura` の共有契約を優先する。
- Web固有処理はadapter/bootstrapへ置き、domainへDOM、storage、SDKを持ち込まない。

## 再利用する資産

Repositoryで provenance と利用条件が確定した資産だけを使う。Kenney Fantasy Town / Nature / Pirate、KayKit Dungeon Remastered、Kenney Particle、repository-local Lucide UI、既存の共有world/terrain/catalogを利用可能とする。Character/Motion pipelineが所有するVRM/animationはその契約を壊さず参照する。

## 捨てる構造

- 3.7MB級の単一HTMLを本編bootstrapとして読み込む構造。
- 起動前に本編全体を静的importする構造。
- タイトル演出完了まで操作を固定時間ブロックする構造。
- 旧巨大Simulation、prototype差し替え、QA APIを製品runtimeとして利用する構造。
- UI都合で共有world座標やentity IDを作り直す処理。

## 新しい起動契約

1. HTML/CSSと最小bootstrapだけで即時にタイトル/続きから/新しい人生を表示する。
2. WebGL/Three.js、world、character、motionは必要になった時点でdynamic importする。
3. タイトル表示中にidle prefetchしてよいが、prefetch完了を操作可能条件にしない。
4. 本編開始後は `shell -> world -> avatar -> simulation` の段階起動とし、各段階が失敗しても戻る/再試行を提供する。
5. 低性能端末では描画品質を自動的に落としても、ゲームruleとworld stateを変えない。

## 最初の縦切り受入条件

- cold startでHTML表示後すぐにタイトル操作が可能で、固定3.8秒/650ms待ちを持たない。
- 新しい人生/続きからを選択できる。
- 0歳、年齢、体力、スタミナ、現在目的をdomain stateとして持ち、保存/復元できる。
- 村の共有worldを読み、本人を配置し、移動/休息/会話/文脈行動の入口を持つ。
- 7歳/15歳/90歳のgateをdomainで判定する。
- 本編runtimeは必要な描画moduleをlazy loadする。
- 旧稽古場は再構築完了まで独立入口として残し、本編bootstrapへ混ぜない。

## 移行方針

再構築は同じ `apps/rinne` の新entryへ切り替える。旧本編/タイトル実装は初回PRでは削除せず未参照にして回帰時の比較材料として残す。新entryがfast validationと公開browser確認を通った後、後続PRで未参照legacyを削除する。

main / Productionはこの作業では変更しない。