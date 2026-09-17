# Rinne Impact Director

Tidebreak の確定戦闘結果を変更せず、ローカル presentation だけで命中の重量感を増幅する。世界時計、敵AI、HP判定、ネットワーク同期は通常速度を維持する。

## 受入条件

- 通常命中、強打、急、ワンモーション、致命打を Impact Energy で分類する。ダメージ値だけでなく武器重量、攻撃種、Tidebreak progress、接触方向、直撃/ガードを材料にする。
- 強い命中はローカル描画のみで短い hit stop → micro slow → 復帰を行う。他プレイヤー、AI、simulation dt、共有時計を遅くしない。
- カメラはランダム振動ではなく攻撃方向へ impulse を出し、強打は軽い FOV punch を許可する。
- Tidebreak pose の hand/tip を使って武器先端と軌道を presentation へ渡し、#739 の authored slash を可能な範囲で実武器軌道へ追従させる。
- 命中前は attack progress の加速域で anticipation trail を出し、命中確定前に impact を捏造しない。
- 強打直前はローカル音響を短く duck し、命中時に復帰させる。共有音声時計やsimulationは変更しない。
- 被弾リアクションは event の part/sector と攻撃方向から頭・胴・腕・脚の違いを presentation pose に反映する。怯み耐性・復帰無敵は追加しない。
- reduced motion、低負荷tier、document hidden では slow/camera/trail を縮退または停止する。
- すべて presentation 層で完結し、Tidebreak のヒット判定、Rinne のHP、マルチ同期、ゲーム内成長契約を変更しない。

## 非目標

- 世界全体の timeScale 変更
- マルチ相手のsimulation停止
- ヒット判定の再実装
- 自動怯み救済
- #739 の authored effect asset provenance 変更

Depends-On: #739
