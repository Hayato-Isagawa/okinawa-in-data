# 0006. build.yml と e2e.yml は PR でだけ回し、main への push では回さない

日付: 2026-11-19
状態: 採用

## 背景

`build.yml` と `e2e.yml` は 2026-09-01 から `pull_request` でだけ動き、`main` への push では動かない。決めた時点では ADR を書かず、理由は両ファイルの冒頭と `AGENTS.md`「テスト」に書いてきた。この ADR はその決定を記録し、公開後に変わった前提を足して見直す。

外したときの理由は次のとおり(`e2e.yml` の冒頭と同じ):

- 2026-08-21 に月の Actions 枠が尽き、private 全リポの CI が 10 日間止まった。姉妹リポのアクセス解析は 4 日ぶん回収できなくなった
- このリポの E2E は 2026-08-01〜08-20 に、push の run だけで 131 課金分を使っていた(18 run を job 単位で切り上げた値)
- push[main] の run だけが捕まえた失敗は、全期間で 0 件だった

キャッシュは、`refs/heads/main` の run が作ったものだけが全 PR から引ける。PR が作ったものは他の PR から見えない。push をやめると main でキャッシュを作る run が無くなるので、`e2e.yml` に週 1 回の `schedule` と `workflow_dispatch` を置き、そこで Playwright と npm のキャッシュを作っている。

公開後に分かった、または変わった前提:

1. **理由だった枠の制約は、公開リポには当てはまらない。** このリポは 2026-11-02 に public になった。GitHub の課金の文書(https://docs.github.com/en/billing/concepts/product-billing/github-actions)は、「Standard GitHub-hosted runners in public repositories.」を無料の使い方に挙げている(larger runner は public でも課金)。このリポの workflow はどれも `ubuntu-latest` で動く
2. **「マージ後の再検証は PR で見たものと同じ内容」は、厳密には成り立たない。** 2026-11-19 時点で、`main` のブランチ保護(classic)の必須チェックは `Build site` と `Playwright E2E` で、`strict` は `false`。ruleset 側に必須チェックは無い。PR の check はその run の時点の merge ref で回るので、後から別の PR が `main` に入ると、マージした結果そのものは検証されない。マージ後の `main` では、Workers Builds が各コミットでビルドする(データ検証も回すことは `build.yml` の冒頭による。Workers Builds のビルドコマンドはダッシュボードの設定で、リポからは見えない)。E2E は週 1 回の run で遅れて回る。`build.yml` のそれ以外の検査(lint・整形・型・各テスト)は回らない
3. 2026-11-19 時点で、姉妹の public リポ(edu-evidence・edu-law・edu-watch)は `push: branches: [main]` でも CI を回している
4. **Dependabot の自動マージには、push で CI を回しても効かない。** `dependabot-auto-merge.yml` は `GITHUB_TOKEN` でマージする。GitHub の文書(https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)によれば、`GITHUB_TOKEN` が起こしたイベントは新しい workflow run を作らない(例外は `workflow_dispatch`・`repository_dispatch` と、PR の `opened` / `synchronize` / `reopened`)

## 検討した選択肢

- **(a) PR でだけ回す(現状。採用)**: マージ後の `main` で回らない検査が残る(前提 2)
- **(b) `push: branches: [main]` で `build.yml` と `e2e.yml` を戻す**: 費用はかからず、姉妹リポともそろう。人がマージした分は、マージした結果そのものを検証でき、マージのたびに `main` のキャッシュも温まる。ただし、main への唯一の自動書き込み経路である Dependabot の自動マージは覆えない(前提 4)。戻すなら `concurrency`(`group: …-${{ github.ref }}` と `cancel-in-progress: true`)も変える必要がある。このままだと `main` の run どうしと週 1 回の run が同じグループに入り、互いに打ち切り合う
- **(c) PR でだけ回し、ブランチ保護を `strict: true` にする**: マージの前に最新の `main` へ追随させるので、自動マージを含めて、マージした結果が PR の check で検証される。追随のたびに CI を回し直すことになり、追随していない Dependabot の PR は自動マージで止まりうる(実測はしていない)。設定の変更はリポの外で行う

## 決定

(a) を続ける。`build.yml` と `e2e.yml` は `pull_request` でだけ動かし、`main` のキャッシュは `e2e.yml` の週 1 回の `schedule`(と手動の `workflow_dispatch`)で作る。

(b) では、穴のうち一番大きい自動マージの経路が残る。マージ後の `main` でも Workers Builds がビルドしているので、残る穴は、別々に緑だった PR が組み合わさって壊れる場合に限られる。lint・整形・型・各テストの壊れは次の PR の CI まで、E2E の壊れは週 1 回の run まで気づかない。このリポは 1 人で運営していて、同時にマージする PR は少ない。

## 帰結

- 別々に緑だった 2 本の PR が組み合わさって壊れても、lint・整形・型・各テストは次の PR の CI まで、E2E は週 1 回の run まで気づかない
- `main` のキャッシュは最長で 1 週間古くなる。キャッシュは 7 日アクセスが無いと消されるので、週 1 回は境界ちょうどにある(`e2e.yml` の冒頭)。マージ直後に温め直すなら、`workflow_dispatch` で手で回す
- `build.yml`・`e2e.yml`・`AGENTS.md` の該当箇所からこの ADR を指す

## 撤回 / 再検討の条件

- push[main] でしか捕まえられない失敗(組み合わせで壊れた `main`)が実際に起きたとき。(b) か (c) を検討する
- リポを private に戻すか、GitHub が public リポの標準ランナーを課金対象にしたとき。枠の制約が理由として戻る
- 同時にマージする PR が増えたとき(共同運営になる、自動マージの対象を広げる、など)
