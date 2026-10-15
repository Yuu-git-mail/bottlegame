// 全面が解けるかを確かめる: node games/screw/check.mjs
// 1) 面を作ったときの取り順を、本当の規則(箱 2 つ・置き場 5)で模擬して解けること、置き場の最大使用が 3 以下
// 2) ヒントと同じ探索で、最初の形から解が見つかること
import { readFileSync } from 'fs';
const src = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const core = src.slice(src.indexOf('/*CORE*/'), src.indexOf('/*CORE-END*/'));
const C = new Function(core + '; return ScrewCore;')();
let bad = 0;
const t0 = Date.now();
for (let lv = 0; lv < C.LEVEL_COUNT; lv++) {
  const t = Date.now();
  const L = C.makeLevel(lv);
  const mx = C.simulate(L, L.order);
  const S = C.newState(L);
  const r = C.solve(L, S, 50000);
  let solMax = -1;
  if (r.path) solMax = C.simulate(L, r.path);
  const covered = L.screws.filter(s => s.cover.length).length;
  const freeNow = C.moves(L, S).length;
  const ok = mx >= 0 && mx <= C.GEN_BUF && r.path && solMax >= 0 && L.screws.length % 3 === 0;
  if (!ok) bad++;
  console.log(`面${lv + 1} 板${L.plates.length} ネジ${L.screws.length} 色${L.colors} 箱${L.boxes.length} 隠れ${covered} 最初に外せる${freeNow} 想定解の置き場最大${mx} 探索${r.path ? '解あり' : (r.gaveUp ? '打ち切り' : '解なし')}(${r.nodes}節,置き場最大${solMax}) でたらめ成功${Math.round(L.rate*100)}%(ねらい${Math.round(L.target*100)}%) 作り直し${L.att} ${Date.now() - t}ms${ok ? '' : ' NG'}`);
}
console.log(bad ? `NG ${bad}` : `OK 全面解ける (${Date.now() - t0}ms)`);
process.exit(bad ? 1 : 0);
