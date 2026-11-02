# 自己ホストフォント

- `bricolage-grotesque-latin.woff2` — [Bricolage Grotesque](https://github.com/ateliertriay/bricolage)
  可変フォント(wght 500–800)の latin サブセット。取得元: Google Fonts(2026-07-05)。
  ライセンス: SIL Open Font License 1.1。欧文の見出し・数字表示にのみ使用
  (和文はシステムフォント。MB 級の和文 Web フォント読み込みを避けるため)。
- 2026-07-21 再生成: Google Fonts 版サブセットに ‰(U+2030)が無く、保護率カードの
  「27.2‰」が‰だけフォールバック(Hiragino)の混植になっていたため、上流
  (github.com/ateliertriay/bricolage main の可変 TTF)から fonttools で再サブセット。
  手順=varLib.instancer で wdth=100 を固定 → pyftsubset で旧ファイルと同じ
  226 コードポイント+U+2030 を woff2 出力。旧ファイルとビルド版(gftools
  0.9.33.dev8)・UPM・既存グリフの字幅が一致することを確認済み。
