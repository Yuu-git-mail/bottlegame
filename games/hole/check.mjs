// 各面で「自動の動き」が時間内に目標へ届くかを確かめる: node games/hole/check.mjs [面番号]
// 敵の動きの乱数(seed)を 5 通り変えて回す。面の街の配りは面ごとに固定。
import { readFileSync } from 'fs';
const src = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const core = src.slice(src.indexOf('/*CORE*/'), src.indexOf('/*CORE-END*/'));
const C = new Function(core + '; return HoleCore;')();
const SEEDS = 5, NEED = 5;   // 5 通りのうち NEED 通り以上で届けば OK
const only = process.argv[2] ? Number(process.argv[2]) - 1 : null;
function run(lv, seed, slow) {
  const G = C.newGame(C.makeLevel(lv), { auto: true, seed });
  if (slow) { G.holes[0].spd = 0.75; G.holes[0].thinkInt = 0.6; }
  while (!G.done) C.step(G, 1 / 30, null);
  return G;
}
let bad = 0;
const t0 = Date.now();
for (let lv = 0; lv < C.LEVEL_COUNT; lv++) {
  if (only !== null && lv !== only) continue;
  const rs = [];
  for (let s = 0; s < SEEDS; s++) rs.push(run(lv, s, false));
  const wins = rs.filter(G => G.win);
  const G = rs[0], gi = C.goalInfo(G), p = G.holes[0];
  const times = wins.map(g => Math.round(g.t)).sort((a, b) => a - b);
  const ok = wins.length >= NEED;
  if (!ok) bad++;
  // 参考: 遅い自動(速さ 0.75 倍・考える間隔 0.6 秒。人の手の代わり)
  let slowWins = 0;
  for (let s = 0; s < SEEDS; s++) if (run(lv, s, true).win) slowWins++;
  console.log(`面${lv + 1} ${ok ? 'OK' : 'NG'} ${gi.text} 届いた${wins.length}/${SEEDS} 時間[${times.join(',')}]s 星${C.stars(G)} 自分${Math.round(p.r * 2) / 10}m 飲まれ${rs.reduce((a, g) => a + g.holes[0].lost, 0)} 物${G.objs.length} 遅い自動${slowWins}/${SEEDS}`);
}
console.log(bad ? `NG ${bad} 面` : 'OK 全面 時間内に届く', `(${Date.now() - t0}ms)`);
process.exit(bad ? 1 : 0);
