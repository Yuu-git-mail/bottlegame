# ボトルソート + ゲーム集

公開: https://yuu-git-mail.github.io/bottlegame/ （ボトルソート本体）
ゲーム集: https://yuu-git-mail.github.io/bottlegame/games/

GitHub Pages は main ブランチの直下をそのまま配信する。

## 構成

- `index.html`, `assets/` … ボトルソートのビルド結果（`npm run build` が dist/ から同期する。手で編集しない）
- `app/index.html` … 開発用の入口（`npm run dev`、ポート 8024）
- `src/` … ボトルソートのソース（TypeScript）
  - `game/BoardGenerator.ts` … 1〜20 面は従来の乱数生成、21 面以降は種付き乱数＋ソルバー検証
  - `game/Levels.ts` … 21 面以降の仕掛けの設計（10 面ごとに 色が多い / かくし色 / 鍵付き / 手数制限 / 高い瓶 / 空き瓶 1 本 / 混合 / エンドレス）
  - `game/Solver.ts` … A* ソルバー（面の検証・par・ヒント）
  - `game/BakedLevels.ts` … `npm run bake` が生成する「解ける試行番号と最短手数」の表
  - `game/Viewport.ts` … iPad / iPhone Safari の可視高さを追う
  - `game/GameEngine.ts` … 盤面の配置（画面に全部入る列数を選ぶ）と描画
- `games/` … ゲーム集（ビルド不要の静的 HTML）
  - `games/index.html` … 一覧
  - `games/css/common.css`, `games/js/common.js` … 共通の全画面レイアウトとヘルパー（GameHub）
  - `games/docs/GAME_SPEC.md` … 各ゲームが従う仕様（画面の骨格・点検表・禁止事項）
  - `games/_template/index.html` … 最小の動く例
  - `games/<name>/index.html` … 各ゲーム（1 ファイル完結）

## 手順

```
npm install
npm run dev      # 開発サーバー
npm run build    # tsc → vite build → dist を直下へ同期
npm run bake 60  # 21〜60 面の盤面をソルバーで検証して表に焼く（Levels.ts を変えたら）
```

ビルド後に `index.html` と `assets/` をコミットして main へ push すると公開される。

## 保存データ（localStorage）

- `magic_sort_saved_game_state` … 遊んでいる途中の盤面（v1 から互換）
- `magic_sort_cleared` … クリア済みの面と手数・星
- `magic_sort_overlay_mode` ほか … 見え方サポートの設定
- `gamehub:<game>:<key>` … ゲーム集の各ゲームのベストや途中経過

## 関連資料

- ~/ドキュメント/AiChatNotes/開発/スマホブラウザHTML資料/ … Safari の可視領域、ゲーム画面の作り方、依頼に使う資料サイト
