# 三界の調べ 150曲 MIT再レンダリング

現行150曲は作曲・MIDI自体はオリジナルですが、TimGM6mb SoundFontを使った試聴レンダーのため `commercialClearance=false / review-required` のままです。この文書と `tools/rerender-bgm150-mit.mjs` は、曲構成を維持したままレンダー音源だけを権利条件の明確なものへ交換するための手順です。

## 採用する音源

MuseScore_General SoundFont 0.2系を使用します。配布元は MuseScore の OSU Open Source Lab mirror です。

- SoundFont: `https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/MuseScore_General.sf3`
- License: `https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/MuseScore_General_License.md`
- Sample sources: `https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/MuseScore_General_Sample_Sources.csv`

MuseScore_General は MIT License。生成した波形にもSoundFontの一部が含まれる扱いとなるため、MITの著作権表示と許諾表示を関連ドキュメントへ保持します。SoundFont自体はゲーム配布物へ同梱しません。

## 入力

`Rinne_BGM_150_Studio.html` の `script#catalogData` にある150曲の `midiBase64` を正本として使います。各MIDIは埋め込み済み SHA-256 と一致しなければ処理を停止します。現在のランタイムカタログは `packages/audio/src/catalog.json` を使います。

## 実行

```sh
node packages/audio/tools/rerender-bgm150-mit.mjs \
  --studio /path/to/Rinne_BGM_150_Studio.html \
  --soundfont /path/to/MuseScore_General.sf3 \
  --license /path/to/MuseScore_General_License.md \
  --sampleSources /path/to/MuseScore_General_Sample_Sources.csv \
  --currentCatalog packages/audio/src/catalog.json \
  --output /path/to/bgm150-mit-output
```

必要コマンドは `fluidsynth`, `ffmpeg`, `ffprobe` です。出力は150個のOgg、検証済みMIDI、更新カタログ、SoundFont SHA-256、MITライセンス証跡を含みます。

## 置換時の条件

1. 150曲すべてがOggとしてデコード可能で、各ハッシュが一意であること。
2. Studioに埋め込まれた全MIDIのSHA-256が一致すること。
3. MITライセンス本文とサンプル出典表をRepositoryの関連ドキュメントとして保持すること。
4. 新レンダーを `packages/audio/assets/audio/` に置換し、`packages/audio/src/catalog.json` のハッシュを新しい値へ更新すること。
5. `packages/audio/tests/catalog.test.mjs` を新しい権利状態に合わせて更新し、150曲の全ハッシュ検証、各ゲーム48曲、CI/buildを通すこと。
6. 旧TimGM6mbレンダーをProduction/DEVの配信対象から除外したことを確認してから `commercialClearance=true` を正式採用すること。

MIDIを取得できない場合、Oggから推測・耳コピ・再構成して代用しません。原曲を変えずに権利だけクリーン化するためです。
