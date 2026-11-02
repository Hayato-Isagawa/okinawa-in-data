# 0002. Cloudflare Web Analytics を手動スニペット方式で導入し CSP を最小限緩和する

日付: 2026-07-12
状態: 採用

## 背景

公開初日からプライバシー配慮型の実訪問計測(Cloudflare Web Analytics、cookie なし)を持ちたい。姉妹プロジェクト(edu-evidence ファミリー)では、WA サイトの「自動セットアップ」モードとビーコンの組合せ不整合により RUM 収集が POST を 503 で拒否し、3ヶ月間イベント 0 件という障害を経験・修復した(2026-07-12)。同じ轍を踏まない構成を初期から採用する。

本リポジトリの規約(CLAUDE.md)により、CSP の script-src を緩める変更は ADR に理由を残す。

## 決定

1. WA サイトは「JS スニペットのインストールで有効にする」(手動)モードで作成し、ビーコンを `BaseLayout.astro` に静的に埋め込む(トークンはリポジトリ管理)。エッジ自動注入は使わない
2. `public/_headers` の CSP を最小限追加する
   - `script-src` に `https://static.cloudflareinsights.com`(ビーコン読込元)
   - `connect-src` に `https://static.cloudflareinsights.com https://cloudflareinsights.com`(計測送信先)
3. ビーコンに SRI(integrity)は付与しない。beacon.min.js は Cloudflare が継続更新する evergreen スクリプトで、ハッシュ固定は CF 側更新のたびに読込失敗＝無音の計測停止(上記障害と同型)を招く。読込元は script-src で単一ホストに固定済みで、ホスティング(Cloudflare Workers)と同一信頼境界のため SRI の追加防御効果は限定的

## 影響

- 全ページに外部スクリプト 1 本(約数 KB、defer 相当の module)
- 計測はドメイン単位(okinawa-in-data.org)。検証手順: デプロイ後に `POST https://cloudflareinsights.com/cdn-cgi/rum` が 204 を返すこと、ダッシュボードにイベントが記録されること
