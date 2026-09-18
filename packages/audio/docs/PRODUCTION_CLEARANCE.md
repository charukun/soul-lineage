# 三界の調べ 150曲 Production権利クリア

Issue #851 の正式ローンチBlockerを解消するため、オリジナル作曲/MIDI 150曲を維持したまま、権利条件が明確なSoundFontで実音源を再レンダリングする。

## 現状

- 現行150曲は `commercialClearance=false` / `licenseStatus=review-required` / `productionStatus=audition`。
- 元MIDI正本は Library の `Rinne_BGM_150_Studio.html` (`rinne-three-worlds-150-v2`) に150曲分存在する。
- 2026-09-18 の実装セッションで当該HTML 22,908,652 bytes を実行環境へmaterializeできたため、旧PR #30のblocking reasonは解消した。
- 旧PR #30は履歴参照のみとし、最新develop起点で再実装する。

## 採用候補

MuseScore_General SoundFontを第一候補とする。MuseScore公式/OSUOSL配布情報ではMIT Licenseとして公開されている。SoundFont本体はゲーム配布物へ同梱せず、生成したOggと必要なMIT notice/sample source証跡をRepositoryへ保持する。

## 受入条件

1. Studio埋め込み150 MIDIを抽出し、各 `midiSha256` と一致すること。
2. 150曲すべてを権利条件が明確なレンダー経路で生成すること。
3. 150 Oggがデコード可能、個別ハッシュ一致、重複なしであること。
4. `packages/audio/assets/audio/` の配信実体を置換すること。
5. `packages/audio/src/catalog.json` を実体ハッシュへ更新し、条件を満たした場合のみ `commercialClearance=true` とすること。
6. ライセンス本文、著作権表示、sample source等の証跡を保持すること。
7. 旧TimGM6mbレンダーがProduction配信対象に残らないこと。
8. catalog/audioのfocused testsと対象buildを通すこと。

Issue: #851
Supersedes: #30
