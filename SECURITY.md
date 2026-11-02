# Security Policy

## 脆弱性の報告

データでみる沖縄のコード・インフラに関する **脆弱性** を見つけた場合は、公開の Issue ではなく、次のどちらかでご連絡ください。

- GitHub の [脆弱性の非公開報告](https://github.com/Hayato-Isagawa/okinawa-in-data/security/advisories/new)
- メール: **security@okinawa-in-data.org**(サイトの [security.txt](https://okinawa-in-data.org/.well-known/security.txt) と同じ窓口)

次の内容を含めていただけると助かります。

- 影響範囲(リポジトリ / 本番サイト / 依存ライブラリ等)
- 再現手順(可能な限り具体的に)
- 想定される影響(情報漏えい / 任意コード実行 / 可用性 など)

調査・修正のために、詳細を追加でお尋ねする場合があります。

## 報告してほしい例

- 本サイトの XSS / オープンリダイレクト
- CSP などのセキュリティヘッダーの設定不備
- ビルド成果物(`dist/`)に混入している秘匿情報
- GitHub Actions の workflow の権限や入力の扱いの不備

## 報告不要な例

- サポートの終わった古いブラウザでのみ起きる表示崩れ
- 数値や出典の誤り(データの誤りは公開の Issue でお知らせください)

## 開示方針

修正がリリースされるまで、公開を控えていただけると助かります。
