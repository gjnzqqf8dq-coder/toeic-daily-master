# Daily Master — 引き継ぎメモ（2026-10-02）

本番: https://gjnzqqf8dq-coder.github.io/toeic-daily-master/ （repo gjnzqqf8dq-coder/toeic-daily-master・main を push で自動公開）
ローカル: `~/Downloads/TOEIC Daily Master/_作業/toeic-daily-master/`

## 編集 → 確認 → 公開
1. `src/partA.html`（CSS・HTML）/ `src/logic.js`（保存・出題の組み立て）/ `src/partC.js`（画面・音・演出）を編集
2. `./build.sh` → index.html を生成（index.html は直接いじらない）
3. プレビュー: Claude の preview_start `daily-master`（http://localhost:8791）
4. 確認（~/webtool で実行。Playwright の WebKit=iPhone と Chrome=PC）
   - `node tools/qa_daily.mjs <出力dir>` … 15画面×2を撮影＋エラー収集 → `node tools/sheet.mjs <dir> ios_ 8 190 out.png` で一覧
   - `node tools/overflow.mjs` … 全画面の横はみ出し（スマホの横ずれ）検出
   - `node tools/perf_daily.mjs` … CPU6倍遅延で回答8回の固まり時間
   - `node tools/flipvid.mjs <dir>` … 暗記カードのめくりを録画（答えが透けないか）
   - `node tools/flipperf.mjs` … CPU6倍遅延でめくりの反応時間とコマ落ち（めくりはCSSアニメだけで回す・途中にJSを挟まない）
   ※ tools は ~/webtool に同名で置いてある（playwright がそこに入っている）
5. データjs を変えたら `src/partA.html` と `sw.js` の `?v=` と `CACHE` 名を上げる（上げないと端末キャッシュで古いまま）
6. `git add -A && git commit && git push` → 1分ほどで反映。報告は毎回フルURLで

## 仕様の要点（本人の決定）
- 単語1日100語（終わったら＋100）、顔は1日40人（＋20）。4択と暗記カードをホームで切替
- 間隔反復: 新出○→3日後／✕→翌日＋8問後に再出題／復習○→1,3,7,14,30,60日。復習は上限60%で新出を必ず混ぜる
- 1問6秒（めくる/答えるまで）。スコア＝10×コンボ倍率（5連続×2→10×3→20×4→30×5）＋早押し+5。累計XPでレベル
- 記録は localStorage＋IndexedDB の二重保存（250msまとめ書き＋画面を閉じる時に即保存）
- 見た目は Duolingo の公開仕様（Owl #58cc02 / Swan #e5e5e5 / 下リップ4px / 角16 / 16px800）。絵文字は使わず手描きSVG
- 日本語フォントは Hiragino Maru Gothic を先に（Google の日本語フォントは分割DLで重くなるので）
- 顔カード裏・判定帯の並び: 名前(よみ)→会社→役職→「行く回」1行→代表作
- 動きは控えめ（目がチカチカすると言われた）。カードは真横で入れ替える2段めくり

## 顔データ（people.js）
- 虎ノ門広告祭: 公式 JSON https://toradfes.com/media/26/json/creators.json / sessions.json
- group: `tc`=行く回の登壇者145人（Googleカレンダーの【虎広】32枠＋toracoya DAY2-5 と照合・`tools/cal_events.txt`）→最優先・会う日が早い順
  `toraA`=必修 / `toraB`=その他 / `idea`=アイデアの学校 講師 / `peer`=同期（本人は除外）
- 代表作は公式プロフィール文から抽出（309/494人）。写真なし→石塚啓(電通デジタルのリリース)・矢後直規(宣伝会議Brain)を手で追加
- 同期の写真を含むので `robots.txt` と noindex を消さないこと

## 未解決
- iPhone の振動：Web では不安定（ボタンを label＋input[switch] にして直押しで触覚）。確実にするならネイティブアプリ化（JS側の受け口 `window.webkit.messageHandlers.haptic` は実装済み）
- Duolingo の実音源は著作権のため不使用（合成で近づけている）
