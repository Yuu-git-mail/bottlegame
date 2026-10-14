import { defineConfig } from 'vite'

// 開発用の入口は app/index.html（ルートの index.html はビルド結果の置き場）
export default defineConfig({
  root: 'app',
  base: './',
  publicDir: false,
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // 古い iPad の Safari でも動くよう ?. ?? などを変換する
    target: ['es2017', 'safari12'],
    modulePreload: false,
    cssTarget: ['safari12']
  },
  server: {
    port: 8024,
    host: true,
    allowedHosts: true,
    fs: { allow: ['..'] }
  }
})
