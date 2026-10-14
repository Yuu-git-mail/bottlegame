# ゲーム集 ゲームページ仕様（games/docs/GAME_SPEC.md）

このリポジトリは GitHub Pages で配信する。ルート `/` はボトルソート本体（Vite ビルド）、`/games/` がゲーム集。
各ゲームは `games/<name>/index.html` 1 枚（CSS/JS 内蔵可）。共通の `../css/common.css` と `../js/common.js` を読む。

対象機: iPhone(幅 375〜430)・iPad mini(768×1024、Safari の URL バーとお気に入りバーが常に出る)・PC。
母親世代が iPad mini の Safari で遊ぶ。PWA にはしない。**縦でも横でも、スクロール無しで全部見える**こと。

## 1. 画面の骨格（必ずこの形）

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>ぷよぷよ - ゲーム集</title>
  <link rel="stylesheet" href="../css/common.css">
  <style>/* このゲームだけの追加スタイル */</style>
</head>
<body class="game">
  <div class="app">
    <header class="app-bar" data-title="ぷよぷよ" data-back="../index.html" data-reset></header>
    <div class="app-hud">
      <span class="hud-item">スコア<b id="score">0</b></span>
      <span class="hud-item">ベスト<b id="best">0</b></span>
    </div>
    <main class="app-main">
      <div class="stage" id="stage">
        <canvas class="stage-canvas" id="cv"></canvas>
      </div>
      <div id="help-sheet" class="sheet hidden">
        <div class="sheet-body">
          <h3>遊び方</h3>
          <ul><li>…</li></ul>
          <h3>操作</h3>
          <ul><li>スマホ: …</li><li>PC: …</li></ul>
        </div>
      </div>
    </main>
    <div class="app-controls">
      <div id="dpad"></div>
      <div class="ctl-group"><button class="ctl-btn wide" id="btn-rotate">回転</button></div>
    </div>
  </div>
  <script src="../js/common.js"></script>
  <script>/* ゲーム本体 */</script>
</body>
</html>
```

- `body.game` は position:fixed で高さ `--app-h`（common.js が可視高さを入れる）。**100vh / 100dvh を書かない。**
- `.app-bar` は common.js が「← 一覧 / タイトル / ? / ↻」を描く。`data-reset` があれば ↻ が `window.resetGame()` を呼ぶ。`#help-sheet` があれば ? が開く。
- `.app-main` が残り全部の高さ。盤面はその中の `.stage` に入れ、**`GameHub.fitStage` か `GameHub.canvasStage` で縦横比を保って収める**。
- 操作ボタンが要るゲームだけ `.app-controls` を置く。要らなければ書かない。
- 説明文・ルール・著作権などの長い文章はページに並べない。`#help-sheet` に入れる。

## 2. common.js（window.GameHub）の使い方

- `GameHub.canvasStage(canvas, baseW, baseH, onLayout)` … canvas 1 枚の定型。盤面は `baseW×baseH` の論理座標で描く。resize で `onLayout(cssW, cssH, ctx, scale)` が呼ばれる。**ctx は DPR 補正だけ**なので、論理座標で描くなら onLayout の中で `ctx.scale(scale, scale)` を掛けてから再描画する（_template 参照）。`st.toBase(clientX, clientY)` でタップ位置を論理座標に。最初の 1 回は戻り値を代入する前に呼ばれるので、draw 側で未初期化を弾くか、戻り値に依存しない形にする。
- `GameHub.fitStage(stageEl, baseW, baseH)` … DOM 盤面(グリッド等)用。幅・高さを px で入れる。中身は `%` か CSS grid の `1fr` で組む。
- `GameHub.onResize(fn)` … 自前で合わせたいとき。
- `GameHub.overlay({title, big, html, buttons:[{label,onClick,secondary}], tapAnywhere})` … 開始・一時停止・ゲームオーバー・クリア画面。`alert/confirm` は禁止。
- `GameHub.toast(msg)` … 短い通知。
- `GameHub.onTap(el, fn(x,y))` … タップ。二重発火を防いである。
- `GameHub.swipe(el, fn(dir), onTap)` … スワイプ(2048・スネーク等)。
- `GameHub.dpad(containerEl, onDir(dir, pressed), {center:{label,onPress}, repeatMs})` … 十字キー。押しっぱなし対応。
- `GameHub.holdButton(btn, onDown, onUp, repeatMs)` … 単独ボタン。
- `GameHub.keys({ArrowLeft: fn, ' ': fn, Enter: fn})` … キーボード。PC でも遊べるようにする。
- `GameHub.store('puyo')` … `get(key, def)` / `set(key, val)`。ベストスコアは必ず保存。
- `GameHub.audio.click()/good()/bad()/win()/beep(freq,dur)` … 効果音。最初のタップで有効化される。
- `GameHub.loop(update(dt), draw)` … rAF ループ。`pause(true)` で止まる。
- `GameHub.pauseWhenHidden(onHide, onShow)` … 画面を離れたら必ず一時停止（アクション系は必須）。
- `GameHub.isTouch` … タッチ機かどうか。

参考実装: `games/_template/index.html`（そのまま動く最小例）。

## 3. 進行不可バグの点検表（全部確認する）

1. 開始: 読み込み直後に盤面が描かれている（真っ黒・白紙を出さない）。開始オーバーレイがあればタップで始まる。
2. 入力: タッチとキーボードの両方で全操作ができる。ボタンは 44px 以上。押しても反応しない瞬間が無い。
3. 判定: 勝ち・負け・詰み（手が無い）を正しく検出し、必ずオーバーレイで次の行動（もう一度 / 次の面 / 一覧へ）を出す。
   - 落ち物: 積み上がったらゲームオーバー。消去の連鎖・落下が止まらない/止まったままにならない。
   - パズル: 解けない盤面を出さない（倉庫番は面データが解けること、ピクロスは一意解、マインスイーパは初手安全）。
   - アーケード: 残機 0 で終了、ステージクリアで次へ。敵・弾が壁をすり抜けない。
4. リセット: ↻ でいつでも最初から。スコア・タイマー・ループが二重に走らない。
5. 中断: 画面を離れたら一時停止。戻っても時間が飛ばない（dt 上限）。
6. 見切れ: 縦(390×664@3, 768×884@2)と横(1024×628@2)で、盤面・操作・HUD が全部画面内。**ページがスクロールしない。**
7. 連打・長押しでブラウザのズーム・選択・コンテキストメニューが出ない。
8. console にエラーが出ない（headless で確認する）。

## 4. 作り込みの方針（見た目を揃える）

- 色は common.css の変数（`--bg` `--panel` `--accent` `--warn` など）。盤面の中は自由だが、背景は `--bg-2` 系の暗色、ピースは彩度の高い色で視認性を取る。
- 文字は大きめ。HUD の数字は 17px 以上。
- 1 ゲーム 1 画面。ページの下に説明カードや余白を作らない。
- ベストスコア保存、難易度か速度の段階、効果音、簡単なアニメーション（消去・落下・クリア）を入れる。
- 面があるゲームは面を増やす（倉庫番 5 → 20 以上など）。面は解けることを確認する。
- 広告ゲームにある「もう一回したくなる」要素: 連鎖・コンボの演出、スコアの伸び、残り数の表示、クリア時の派手さ。

## 5. 確認方法（スクショ）

```
# 1 枚
~/.claude/jobs/35bb4763/tmp/shot.sh games/<name>/index.html out.png 390 664 3
~/.claude/jobs/35bb4763/tmp/shot.sh games/<name>/index.html out.png 768 884 2
~/.claude/jobs/35bb4763/tmp/shot.sh games/<name>/index.html out.png 1024 628 2
```

headless Chrome は http:// だと固まるので file:// で撮る（スクリプトが変換する）。
操作して撮りたいときは selenium（`python3`、`-I` を付けない）で `file://` を開く。例: `~/.claude/jobs/35bb4763/tmp/sel_test.py`。

## 6. やってはいけない

- `100vh` `100dvh` `position: sticky` のヘッダー、ページ全体のスクロール前提のレイアウト。
- `alert` / `confirm` / `prompt`。
- `?.` `??` クラスフィールド `#private`（古い Safari で落ちる）。`let/const/アロー関数/テンプレート文字列` は可。
- 外部 CDN・Web フォント・画像ファイルの読み込み（全部 1 枚の HTML に内蔵。絵は canvas / CSS / 絵文字 / inline SVG で描く）。
- git 操作（commit / branch / stash）。編集だけして報告する。

## 7. 広告で見る型を作るとき（2026-10-14 追加）

持ち主専用のゲーム集。売るためではない。広告ゲームの「なぜそうなってる」を直した版にする。

- 広告・スタミナ・待ち時間・ガチャ・有料アイテムは置かない。補助（戻す・ヒント・シャッフル）は無制限か、面ごとに数回で毎回戻る。
- 戻すは何手でも。詰んだら「手がありません」と教え、戻す/やり直しを出す。
- パズルの面は必ず解ける。完成状態から逆に崩して作るか、node のソルバーで確かめてから入れる。面データを焼くなら最短手数も一緒に。
- 置き場がぎりぎり足りなくなる「課金を誘う面」は作らない。難しさは手順の読み合いで出す。
- 面は 30 面以上を目安に、易しい→難しい。面選択（クリア済みに ✓）と続きから（GameHub.store）。
- 資料: ~/ドキュメント/AiChatNotes/開発/スマホ3Dゲーム案/04_画像で見た型.md（元の広告ゲームの説明と画像 images/）。
