# 0005. サイト内検索に Pagefind を採用し、CSP に 'wasm-unsafe-eval' を足す

日付: 2026-10-08
状態: 採用

## 背景

データセット・市町村ページ・解説が増え、ナビゲーションだけでは目的のページにたどり着きにくくなった。姉妹サイト(edu-evidence / edu-watch / edu-law)はビルド時に索引を作る Pagefind で検索を持っている。

Pagefind は検索を WebAssembly で動かす。CSP の `script-src` に `'wasm-unsafe-eval'` が無いと WASM のコンパイルが拒否され、検索は「検索しています」のまま止まる。本リポジトリの規約では、`script-src` を緩める変更は理由を ADR に残す。

## 検討した選択肢

- **Pagefind(採用)**: 姉妹サイトと同じ方式。本文を検索でき、索引の作成と検索 UI の保守を上流に任せられる。CSP に `'wasm-unsafe-eval'` が要る
- **自前の軽量インデックス**: ビルド時にタイトル・説明・タグの JSON を作り、小さな JS で絞り込む。CSP は変えずに済むが、本文は検索できず、コードを自分たちで保守することになる
- **姉妹サイトと同じ CSP(`'unsafe-inline'` も足す)**: 姉妹サイトは検索の初期化などをインラインスクリプトで書いているため `'unsafe-inline'` を持っている。本リポジトリはスクリプトを外部ファイルに出している(`vite.build.assetsInlineLimit: 0`)ので要らない。足せば XSS への防御を 1 枚失う

## 決定

1. `pagefind` を devDependencies に入れ、`npm run build` を `astro build && pagefind --site dist` にする。CI と Workers Builds はどちらも `npm run build` を呼ぶので、追加の配線は要らない
2. `public/_headers` の `script-src` に `'wasm-unsafe-eval'` だけを足す。`'unsafe-inline'`・`worker-src`・`blob:` は足さない。Pagefind の Worker(`/pagefind/pagefind-worker.js`)は同一オリジンなので、`script-src 'self'` で読める
3. 索引に入れるのは `BaseLayout` の `<main>` に `data-pagefind-body` が付いたページだけにする。検索・404・更新履歴は `searchable={false}` で外す。更新履歴は、データセット名が大量に並んで結果の雑音になるため
4. 表と、市町村ページで全ページに同じ内容が並ぶ部分(代表的な数値のカード・順位の注記・出典のリスト)には `data-pagefind-ignore` を付ける。付けないと、表やカードにしか出ない指標名(例: 就学援助)で検索したときに市町村ページ 41 件が一斉にヒットする。冒頭の要約文と節見出しは残すので、「人口」「教育」などでは市町村ページ 41 件が並ぶ。図・地図の SVG 本体・ナビゲーション・フッター・フォームは、Pagefind が既定で索引しない(図の figcaption は索引される)
5. 初期化は Astro の処理済み `<script>`(外部ファイル)で行う。`pagefind-ui.js` は classic script として先に同期で読み込む

## 帰結

- `'wasm-unsafe-eval'` が許すのは WebAssembly のコンパイルだけで、`eval()` や `new Function()` は許さない。WASM をコンパイルできるのは既に実行を許されたスクリプトだけなので、増える攻撃面は小さい
- **`astro preview` と `astro dev` は `_headers` を適用しない。** CSP を外すと検索が壊れることは、`tests/search.spec.ts` が `public/_headers` の CSP を**全レスポンスに**付けて確かめる。Pagefind は WASM を Worker の中で動かし、Worker の CSP は Worker スクリプト自身のレスポンスのヘッダーで決まる。そのため、HTML 文書にだけ CSP を付けたテストでは、`'wasm-unsafe-eval'` を外しても緑のまま通ってしまう
- `data-pagefind-body` を持つページが 1 つも無いと、Pagefind は全ページの `<body>` を索引する。同じテストで「更新履歴が結果に出ないこと」も見て、索引範囲が後退したら落ちるようにしている
- Pagefind 1.5 は、新しく組み込むなら Component UI を勧めている。ここでは姉妹サイトと揃えて Default UI を使う

## 撤回 / 再検討の条件

- Pagefind が WASM を使わなくなった場合、または `'wasm-unsafe-eval'` に依存しない配布形式が出た場合は、CSP から外す
- Default UI のサポート終了が告知された場合は、Component UI への移行を検討する
