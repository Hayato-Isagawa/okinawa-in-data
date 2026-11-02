# raw/ について

このデータセットの監査証跡(報告書を `pdftotext -layout` したテキスト)は、リポジトリに入れていません。

- 報告書は国立大学法人(お茶の水女子大学・福岡教育大学)が作成した委託研究の成果で、文部科学省の利用規約が対象外とする「国以外の者」の著作物に当たる可能性があり、全文の再配布ができるか確認できていないため

原本は meta.json の出典から取得できます。

- 本編その1(令和5年3月): https://www.mext.go.jp/content/20230601-mxt_chousa02-000029720-3.pdf
- 報告書(SES 指標の作成方法: 第2章): https://www.mext.go.jp/content/20230601-mxt_chousa02-000029720-1.pdf

変換スクリプト(`scripts/convert/ses-gakuryoku-hogosha-chosa.ts`)は `raw/ocha_r3_hogosha_honpen1.txt`(本編その1 を `pdftotext -layout` したもの)を読みます。動かすときは取得してこの名前で置いてください(`.gitignore` で追跡しないようにしてあります)。
