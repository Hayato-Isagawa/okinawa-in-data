# raw/ について

このデータセットの監査証跡(報告書の該当ページを `pdftotext -layout` で抜き出したテキスト)は、リポジトリに入れていません。

- 出典の沖縄県サイトの利用規約は、著作権法で認められた場合を除いて転用・引用を認めていません(https://www.pref.okinawa.lg.jp/about/1018114.html)
- 県から得た利用確認(meta.json の `license.note`)の対象は、数値の掲載と内容を変えない再構成で、報告書本文の転載は含みません

原本は meta.json の出典から取得できます。

- 令和6年度 沖縄こども調査(小中学生調査)報告書 概要版: https://www.pref.okinawa.jp/_res/projects/default_project/_page_/001/034/906/gaiyou-r6-kodomo-chousa.pdf(アーカイブ: https://web.archive.org/web/20260914142610/https://www.pref.okinawa.jp/_res/projects/default_project/_page_/001/034/906/gaiyou-r6-kodomo-chousa.pdf)

変換スクリプト(`scripts/convert/kodomo-chosa-konkyu-keinen.ts`)は `raw/gaiyou-r6-kodomo-excerpt.txt` を読みます。動かすときは、概要版 p.9〜11 を `pdftotext -layout` で抜き出してこの名前で置いてください(`.gitignore` で追跡しないようにしてあります)。
