# ボトルソート 仕様（v2.0.0、2026-10-14）

## ルール

- 瓶 i には容量 cap[i] と色の列 bottles[i]（下から上）がある。
- from → to へ注げる条件: from が空でない、to に空きがある、to が空か to の最上段の色が from の最上段と同じ、どちらも鍵が閉じていない。
- 注ぐ量 = min(from の上から続く同色の層の数（かくし層は含めない）, to の空き)。
- 完成した瓶 = 満杯・単色・かくし層なし。全部の非空の瓶が完成で勝ち。

## 仕掛け（21 面以降）

- かくし色: hidden[i] = 下から何層が見えないか。最上段は常に見える。注いで層が減ると hidden[i] = min(hidden[i], length-1)。
- 鍵: locks[i] = { color } の瓶は、その色の瓶が 1 本完成するまで出し入れ不可。
- 手数制限: moveLimit に達して未クリアなら「手数切れ」。戻す/やり直しで続行可。
- par: ソルバーの最短手数。星は moves ≤ par で 3、≤ par+4 で 2、それ以外 1。1〜20 面は par なし。

## 面の生成

- 1〜20: BoardGenerator.generate（従来のまま。Math.random、逆注ぎ 50×色数回）。
- 21 以降: Levels.specFor(level) の仕様 → BoardGenerator.build(spec, attempt)（種 = level*7919 + attempt*104729 + 17 の mulberry32）→ Solver.solve で検証。
  - 条件: 解ける、最短手数 ≥ spec.minMoves。
  - BakedLevels.ts に level → [attempt, par] を焼いてあり、実行時は表を引くだけ。表に無い面はその場で最大 40 試行 × 3 万状態で探す。
- ソルバー: A*、h = 各瓶の色の切れ目の合計、同じ容量・鍵の瓶を並べ替えて状態キーを縮める。単色の瓶を空へ移す手は枝刈り。

## 画面

- 可視高さ: Viewport.ts が innerHeight と visualViewport.height の小さい方を --app-h に入れる。body は position:fixed。
- 盤面: GameEngine.computeLayout が列数 1..n を総当たりし、瓶（幅 64、層 24、余白込み）が全部入る最大倍率の列数を選ぶ。最後の行は中央寄せ。canvas の CSS サイズは px で明示、内部は DPR（上限 3）。
- 入力: PointerEvent があれば pointerdown のみ、無ければ touchstart + mousedown。120ms デバウンス。当たり判定はセル単位。

## 保存（localStorage）

- magic_sort_saved_game_state … GameState.toJSON()。v1（hidden/locks 無し）も GameState.fromJSON で読める。
- magic_sort_cleared … { [level]: { moves, stars } }。
- magic_sort_overlay_mode / magic_sort_colorblind_palette / magic_sort_highlight_same_color … 見え方サポート。

## ビルドと配信

- Vite root は app/、出力 dist/、`scripts/sync-root.mjs` が index.html と assets/ を直下へコピー。
- build.target = ['es2017', 'safari12']。
- GitHub Pages は main 直下（legacy）。ビルド結果をコミットして push する。
- games/ はビルド不要の静的ファイル。仕様は games/docs/GAME_SPEC.md。
