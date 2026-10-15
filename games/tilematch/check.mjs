// 全面が解けるかを確かめる: node games/tilematch/check.mjs
// 1. 作った取り順どおりに遊び、枠が 7 にならずに全部消えるか
// 2. ヒントの探索(上限 20000 ノード)が最初の状態から解を見つけるか
import { readFileSync } from 'fs';
const src = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const core = src.slice(src.indexOf('/*CORE*/'), src.indexOf('/*CORE-END*/'));
const C = new Function(core + '; return TileCore;')();
let bad = 0, hintMiss = 0;
for (let lv = 0; lv < C.LEVEL_COUNT; lv++) {
  const t0 = Date.now();
  const L = C.makeLevel(lv);
  const P = L.P;
  const r = C.playOrder(L, L.order);
  const used = new Set(L.tiles.map(t => t.t)).size;
  const counts = {};
  L.tiles.forEach(t => { counts[t.t] = (counts[t.t] || 0) + 1; });
  const mult3 = Object.values(counts).every(c => c % 3 === 0);
  const s0 = C.newState(L);
  const free0 = C.freeList(L, s0).length;
  const h = C.solve(L, s0, 20000);
  let hintOk = false;
  if (h.path) { const s = C.newState(L); h.path.forEach(id => C.take(L, s, id)); hintOk = C.isWon(s); }
  // 目安: 枠と同じ絵を優先し、無ければ見えている 3 枚組、無ければ乱数で取る素朴な遊び方の成功率(100 回)
  let a = (lv + 1) >>> 0, wins = 0;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let k = 0; k < 100; k++) {
    const s = C.newState(L);
    while (!C.isWon(s) && !C.isFail(s)) {
      const fr = C.freeList(L, s), sc = {}, fc = {};
      s.slot.forEach(id => { sc[L.tiles[id].t] = (sc[L.tiles[id].t] || 0) + 1; });
      fr.forEach(id => { fc[L.tiles[id].t] = (fc[L.tiles[id].t] || 0) + 1; });
      let pick = fr.filter(id => sc[L.tiles[id].t]).sort((x, y) => sc[L.tiles[y].t] - sc[L.tiles[x].t]);
      if (!pick.length) pick = fr.filter(id => fc[L.tiles[id].t] >= 3);
      C.take(L, s, pick.length ? pick[0] : fr[Math.floor(rnd() * fr.length)]);
    }
    if (C.isWon(s)) wins++;
  }
  if (!r.ok || r.maxUse >= 7 || !mult3 || L.tiles.length !== P.N) bad++;
  if (!hintOk) hintMiss++;
  console.log(`面${lv + 1} 牌${L.tiles.length} 絵${used} 段${L.layers} ${L.cols}x${L.rows} 最初に取れる${free0} 取り順:${r.ok ? '解ける' : 'NG ' + r.why} 枠最大${r.maxUse}(目標${P.cap}) ヒント探索:${hintOk ? '解けた' : '見つからず'} ${h.nodes}ノード 素朴な遊び方の成功${wins}% ${Date.now() - t0}ms`);
}
console.log(bad ? `NG ${bad}` : 'OK 全面解ける', `ヒント探索で最初から解けなかった面 ${hintMiss}`);
process.exit(bad ? 1 : 0);
