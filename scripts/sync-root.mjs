// ビルド結果(dist/)をリポジトリ直下へ同期する。
// GitHub Pages は main ブランチ直下を配信するため、index.html と assets/ を直下に置く。
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html がありません。先に vite build を実行してください');
  process.exit(1);
}

// 古いハッシュ付きアセットを消してから入れ替える
const assets = join(root, 'assets');
if (existsSync(assets)) {
  for (const f of readdirSync(assets)) rmSync(join(assets, f), { recursive: true, force: true });
} else {
  mkdirSync(assets);
}
cpSync(join(dist, 'assets'), assets, { recursive: true });
cpSync(join(dist, 'index.html'), join(root, 'index.html'));
writeFileSync(join(root, '.nojekyll'), '');
console.log('synced: index.html, assets/ (' + readdirSync(assets).join(', ') + ')');
