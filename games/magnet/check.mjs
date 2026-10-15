// 全面が解けるか・答えがいくつあるかを確かめる: node games/magnet/check.mjs
import { readFileSync } from 'fs';
const src = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const core = src.slice(src.indexOf('/*CORE*/'), src.indexOf('/*CORE-END*/'));
const C = new Function(core + '; return MagnetCore;')();
let bad = 0;
for (let lv = 0; lv < C.LEVEL_COUNT; lv++) {
  const L = C.makeLevel(lv);
  const tiles = L.tiles.filter(Boolean).length;
  const fixedOk = L.tiles.every(t => !t || !t.fixed || t.rot === 0);
  const r = C.solve(L, 2);
  const solved0 = C.isSolved(L);
  if (!r.rots || !fixedOk || solved0) bad++;
  console.log(`面${lv + 1} ${L.W}x${L.H} 磁石${tiles} 目安${C.par(L)} 解${r.count >= 2 ? '2以上' : r.count} 探索${r.nodes}${solved0 ? ' 最初から解けている!' : ''}${fixedOk ? '' : ' 固定がずれている!'}`);
}
console.log(bad ? `NG ${bad}` : 'OK 全面解ける');
process.exit(bad ? 1 : 0);
