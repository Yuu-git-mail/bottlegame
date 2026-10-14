// 21〜N 面について「解けて十分に難しい」試行番号と最短手数を表に焼く。
// 使い方: node scripts/bake-levels.mjs [maxLevel]
// 手順: tsc で src/game を一時ディレクトリへ CommonJS 変換 → 読み込んで探索 → src/game/BakedLevels.ts を書く
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const maxLevel = parseInt(process.argv[2] || '60', 10);
const out = mkdtempSync(join(tmpdir(), 'bake-'));

// 既存の表を保持しつつ空の表で一旦コンパイル (BoardGenerator が読むため)
const bakedPath = join(root, 'src/game/BakedLevels.ts');
const prev = existsSync(bakedPath) ? readFileSync(bakedPath, 'utf8') : '';

execSync(`npx tsc --outDir ${out} --module es2020 --target es2020 --moduleResolution bundler --skipLibCheck --noEmit false --declaration false --isolatedModules false src/game/Rng.ts src/game/Solver.ts src/game/Levels.ts src/game/BakedLevels.ts src/game/BoardGenerator.ts`, { cwd: root, stdio: 'inherit' });
// ESM の拡張子無し import を補う
for (const f of ['Rng', 'Solver', 'Levels', 'BakedLevels', 'BoardGenerator']) {
  const p = join(out, f + '.js');
  let s = readFileSync(p, 'utf8').replace(/from '\.\/(\w+)'/g, "from './$1.js'");
  writeFileSync(p, s);
}
const { BoardGenerator } = await import(pathToFileURL(join(out, 'BoardGenerator.js')).href);
const { specFor } = await import(pathToFileURL(join(out, 'Levels.js')).href);

const table = {};
const m = prev.match(/= (\{[\s\S]*?\});/);
if (m) {
  try { Object.assign(table, Function('return ' + m[1])()); } catch { /* ignore */ }
}

const t0 = Date.now();
for (let level = 21; level <= maxLevel; level++) {
  if (table[level]) continue;
  const spec = specFor(level);
  const b = BoardGenerator.search(level, 200, 80000);
  if (!b) {
    console.log(`L${level} ${spec.theme}: NOT FOUND`);
    continue;
  }
  table[level] = [b.attempt, b.par];
  console.log(`L${level} ${spec.theme}: attempt=${b.attempt} par=${b.par} expanded=${b.expanded} colors=${spec.colors} bottles=${b.bottles.length}`);
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const lines = Object.keys(table).map(k => parseInt(k, 10)).sort((a, b) => a - b).map(k => `  ${k}: [${table[k][0]}, ${table[k][1]}]`);
writeFileSync(bakedPath, `// scripts/bake-levels.mjs が生成する。手で編集しない。\n// level: [attempt, par]\nexport const BAKED_LEVELS: Record<number, [number, number]> = {\n${lines.join(',\n')}\n};\n`);
console.log('wrote', bakedPath);
