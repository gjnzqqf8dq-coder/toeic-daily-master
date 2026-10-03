---
name: TOEIC Daily Master プロジェクト
description: 【2026-10-02 v2】毎日200語の間隔反復＋クリエイティブ(顔と名前)タブ。記録はlocalStorage＋IndexedDB二重保存。GitHub Pages公開
metadata:
  type: project
---
**URL**: https://gjnzqqf8dq-coder.github.io/toeic-daily-master/ （repo gjnzqqf8dq-coder/toeic-daily-master・説明は personal flashcards (private use)）
**ローカル**: `~/Downloads/TOEIC Daily Master/_作業/toeic-daily-master/`（旧 ~/Downloads/Claude/toeic-unified は消えている）
構成: index.html（アプリ）/ words.js（1543語・削らない）/ people.js / p/（顔写真360px）/ robots.txt＋noindex（**同期の写真を含むので消さない**、[[project_dentsu_idea_school_2026]]と同条件）

v2の仕様（2026-10-02 本人の要望）:
- 1日200語→終わったら＋100語ずつ。新出○→3日後、✕→翌日＋当日8問後に再出題、復習○→1/3/7/14/30/60日
- 復習は上限60%（設定で変更可）で新出を必ず混ぜる＝「間違いだけ200語」でモチベが落ちないように
- 記録が消えていた原因: 旧版は15分完走時しか履歴を書かず、iOS Safariは7日でlocalStorageを消す。→1問ごとに保存・IDBに二重化・storage.persist・ホーム画面追加を案内
- エクスポート/インポート/リセットは**不要と言われたので削除**
- クリエイティブタブ: 虎ノ門広告祭2026登壇者494人（公式JSON https://toradfes.com/media/26/json/creators.json ・sessions.json）を「必修253＝2セッション以上 or 広告会社」と「その他241」に分け、必修→講師27→同期16の順に出す。1日40人＋20人追加
- 旧版の履歴(tdm-history-v1)と復習リスト(tdm-wrong-v1)は自動で引き継ぎ
- 【2026-10-02】UIは本人の希望で**Duolingo風**（白地・原色・押すと沈む立体ボタン・緑のマスコット・カードめくり＆左右スワイプ・紙吹雪・振動）。ミニマルな黒UIは「ダサい」と却下された。iPhoneの振動はSafari 18の `<input type=checkbox switch>` クリックで出している
- 【2026-10-02 v3】1日100語（＋100）・1問6秒の制限時間（めくるまで／設定0〜15秒）・スコア＝10×コンボ倍率(×1→5連続×2→10×3→20×4→30×5)＋早押し+5・累計XPでレベル(Lv n=100n(n-1)XP)・ハイスコア。顔カード裏＝名前/会社/役職/代表作（代表作はプロフィール文からAIで抽出、309/494人）。広告祭のセッション名は本人が不要と判断し削除。データjsは `?v=` を上げないと端末キャッシュで古いのが出る
- 【2026-10-02 v4】絵文字アイコンは「AIっぽい」と却下→手描きSVG(炎/稲妻/王冠/本/人物カード/カレンダー/歯車/星/トロフィー)に置換。iPhone無音の原因＝マナーモードでWeb Audioが鳴らない→navigator.audioSession.type="playback"＋旧iOSは無音<audio>ループ。振動はlabel+input[switch]を毎回生成してclick（ios-haptics方式）
- 【2026-10-02 v5】「AIっぽい」→Duolingoの公開仕様（open-design DESIGN.md等: Owl #58cc02/Swan #e5e5e5/4px下リップ/角16/ボタン16px800大文字/進捗16px）で作り直し、出題を**4択＋下から出る判定バナー**に変更（めくり＆自己採点は廃止）。効果音はOfflineAudioContextでWAV化→iPhoneは<audio>プールで再生（Web Audioは鳴らなかった）。iOS振動は「プログラムからclick」では出ない＝ボタン自体を<label>にして中に<input type=checkbox switch>を入れ、指の直押しで触覚を出す。?debug=1 で音の解錠状況を表示。Mac側にiOSシミュレータのランタイム無し
- 【2026-10-02 v6】4択と暗記カード(めくる→まだ/覚えた)をホームの切替で選べる(settings.mode.w/p)。正解音はコイン系(E6→A6 矩形+三角, lowpass)。iOS振動はios-hapticsの実装どおり hidden switch を visibility:hidden で(opacity0+pointer-events:noneでは出なかった疑い)。設定に本物のスイッチ「振動テスト」あり＝これで震えなければ端末側の設定
- 【2026-10-02 v7】連続でやると「目がチカチカ」→横すべり/単語正解時の帯/毎回の粒子を廃止。正解音は「ト(C6マリンバ短)→ピン(G6グロッケン長)」。Duolingoの実音源は著作権のため使わない。iPhone振動はWebでは出ないまま→本命は自作ネイティブアプリ化(WKWebView+UIImpactFeedbackGenerator, JS側は window.webkit.messageHandlers.haptic に success/error/heavy/light を送る受け口を実装済み)。インストールには本人のiPhone接続とApple IDが必要
- 【2026-10-02 v8】**UI確認は必ず `node ~/webtool/qa_daily.mjs <dir>`**（Playwright WebKit=iPhone 13 と Chrome 1280×800 で15画面ずつ自動撮影＋エラー収集、`sheet.mjs`で一覧画像化）。Chrome系だけの確認でSafari固有の崩れ（backface-visibility無視でカード表に裏が透ける等）を見逃した反省。localhost:8791 の preview サーバ前提。class名 .face をカード面と4択写真で衝突させた事故あり
- 【2026-10-02 v9 軽量化】重さの主犯＝Googleの日本語フォント(M PLUS Rounded)が新しい漢字のたびに分割ファイルを追加DL→再レイアウト（15問で22ファイル）。→ font-family は Nunito, **Hiragino Maru Gothic ProN**, M PLUS Rounded の順（iPhone/Macは内蔵丸ゴシック）。ほか offsetWidth 強制レイアウト禁止(el.animateで代替)・タイマーはCSS transition＋setTimeout・save()は250msまとめ書き＋pagehide/visibilitychangeでflush・SFXはboot後700msで1音ずつ・iOSは1音1要素。計測は `node ~/webtool/perf_daily.mjs`（CPU6倍遅延、回答8回の長時間処理: 2489ms→91〜274ms）
- 【2026-10-02 v10】暗記カードのめくりは「backface-visibility＋rotateY180」をやめ、**真横(90°)まで倒す→中身を入れ替え→-90°から起こす**の2段階(Web Animations 130+170ms)。次カードは opacity0 の間に rev解除＋中身差し替え。検証は `node ~/webtool/flipvid.mjs <dir>`（WebKitで録画＋毎フレーム状態記録→ffmpegでタイル化）
- 【2026-10-02 v11】本人は**toracoya 2期生（審査通過・FULL WEEK PASS購入済）**＝行く回は虎子屋 DAY1 10/6・DAY2 10/12・DAY3 10/13・DAY4 10/15・DAY5 10/16（TOKYO NODE）。Macカレンダーには広告祭の予定なし→Gmail(審査通過メール)とsessions.jsonで特定。DAY2-5の講師21人を group "tc"（虎子屋の講師（行く回））として最優先。DAY1は公式データ非公開。石塚啓は公式写真なし→電通デジタルのリリース写真を使用
- 【2026-10-02 v12】「行く回」は**Googleカレンダー**（本人訂正。Macカレンダーではない）。Claude in Chrome で calendar.google.com/calendar/u/0/r/agenda/2026/10/3 を get_page_text（閲覧のみ）。【虎広】32枠＋toracoya DAY2-5 の計36枠→sessions.json と日付・開始時刻で全件一致→登壇者145人を group "tc"（行く回の登壇者）に、初回の日付順で最優先。写真なしは矢後直規のみ宣伝会議Brainの写真で追加、大門一将・大津裕基・匿名枠は除外。照合データ=toradfes/cal_events.txt
- 【2026-10-02 v13】スマホでレッスンが横スクロールしてずれる→原因は #lesson(overflow-y:auto) 内の .lfoot の負マージン(-16px)。負マージン廃止＋#lesson overflow-x:hidden＋body position:fixed。確認は `node ~/webtool/overflow.mjs`（全画面の横はみ出し検出）
