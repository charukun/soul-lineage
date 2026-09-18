# 三界の調べ 150曲 Production権利クリア

Issue #851 の正式ローンチBlockerを解消するため、オリジナル作曲/MIDI 150曲を維持したまま、MIT条件が明確なMuseScore General SoundFontで配信Oggを再レンダリングする。

## 正本

- 元MIDI: Library `Rinne_BGM_150_Studio.html` / `rinne-three-worlds-150-v2`。
- Studio HTML SHA-256: `8d399b0f20e6e93d14de249317958b1f50628b32ee8d65a640220210ed11ecb6`。
- 150 MIDIはRepositoryの `packages/audio/sources/midi/` に保存し、`midi-manifest.json` でStudio埋め込みSHA-256と1:1に固定する。
- 2026-09-18の抽出検証は150/150一致、mismatch 0。

## Productionレンダー

Ubuntu 24.04の `musescore-general-soundfont-small=0.2.1-1` に含まれる `MuseScore_General_Lite.sf3` を使用する。同SoundFontはMITで、派生波形には著作権表示・許諾表示を関連文書として保持する。SoundFont自体はゲーム配布物へ同梱しない。

Repositoryには以下を保持する。

- `packages/audio/assets/licenses/MuseScore_General_License.txt`
- `packages/audio/assets/licenses/MuseScore_General_Sample_Sources.csv`
- `packages/audio/sources/render-provenance.json`

`render-provenance.json` は実際に使用したSoundFontのSHA-256、package version、150 MIDI/Oggの対応ハッシュ、レンダー条件を固定する。

## 受入条件

1. Studio埋め込み150 MIDIとRepository source MIDIのSHA-256が全件一致する。
2. 150曲すべてを同一の権利クリア済みレンダー経路で生成する。
3. 150 Oggがデコード可能で、catalog hashと一致し、重複hashがない。
4. `packages/audio/assets/audio/` の旧TimGM6mb試聴レンダーを全件置換する。
5. `packages/audio/src/catalog.json` は実体hashへ更新し、全曲 `commercialClearance=true` / `productionStatus=production` / `licenseStatus=cleared-mit-render` とする。
6. MIT notice・sample source・render provenanceをRepositoryへ保持する。
7. source MIDI / catalog / audio focused testsを通す。
8. current developへmerge-forward後、affected validationを再実行してReadyへ渡す。

Issue: #851
Supersedes: #30