# 権利・出典の記録

## オリジナル制作部分

「三界の調べ」150曲の旋律・編曲・MIDI・カタログは本プロジェクトで新規作成したデータです。第三者の既存曲・既存MIDIを素材としてコピーしていません。

正本MIDIは `Rinne_BGM_150_Studio.html` (`rinne-three-worlds-150-v2`) から抽出し、`packages/audio/sources/midi-manifest.json` の SHA-256 と150曲すべて一致したものだけを使用しています。

## Productionレンダーで使用した第三者音源

Production向け150 Oggは **MuseScore_General_Lite.sf3** を使用して再レンダリングします。実行環境は Ubuntu 24.04 の `musescore-general-soundfont-small=0.2.1-1` を固定し、SoundFont本体はゲーム配布物へ同梱しません。

MuseScore General は MIT License で公開されています。レンダー波形がSoundFontの一部を含む扱いを前提に、配布パッケージには以下の証跡を保持します。

- `MuseScore_General_License.txt`: 配布パッケージの copyright / license 記録
- `MuseScore_General_Sample_Sources.csv`: サンプル出典表
- `packages/audio/sources/render-provenance.json`: 使用SoundFont SHA-256、固定パッケージ版、レンダー条件、全MIDI/Ogg SHA-256

生成元:
- Ubuntu package: https://packages.ubuntu.com/noble/musescore-general-soundfont-small
- Debian copyright record: https://sources.debian.org/copyright/license/musescore-general-soundfont-small/0.2.1-1/
- Debian installed-file record: https://packages.debian.org/bookworm/all/musescore-general-soundfont-small/filelist

## 制作ツール

FluidSynth と FFmpeg をレンダリング/エンコードに使用します。これらの実行バイナリはゲーム配布物へ同梱しません。ツール自身のライセンスと、入力SoundFont/生成波形の権利条件は区別します。

## 公開可否の状態

Productionレンダー生成・150 Oggの実体検証・ライセンス証跡保存・旧TimGM6mbレンダー除外が完了したカタログのみ、次の状態へ移行します。

- `productionStatus=production`
- `commercialClearance=true`
- `licenseStatus=cleared-mit-render`
- `renderLicense=MIT`

旧TimGM6mb試聴レンダーおよびそのGPL noticeはProduction配信対象から除外します。