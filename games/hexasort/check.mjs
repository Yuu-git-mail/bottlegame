// 素朴な自動プレイ(置ける所のうち消えやすい所)で各面がクリアできるかを確かめる: node games/hexasort/check.mjs
// 運の要素があるので「解ける保証」ではなく「素朴に置いても届く目標か」を見る。
// 目標に届いた後も置けなくなるまで続け、届いた枚数(余裕)も出す。
import { readFileSync } from 'fs';
const src = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const core = src.slice(src.indexOf('/*CORE*/'), src.indexOf('/*CORE-END*/'));
const C = new Function(core + '; return HexaCore;')();

function play(st, capMoves) {
  let moves = 0, winAt = -1;
  while (moves < capMoves) {
    if (C.emptyCells(st).length === 0) break;
    const m = C.autoMove(st);
    if (!m) break;
    C.place(st, m.ti, m.cell);
    moves++;
    if (winAt < 0 && st.cleared >= st.goal) winAt = moves;
  }
  return { moves, winAt, reach: st.cleared };
}

let bad = 0;
const t0 = Date.now();
for (let lv = 0; lv < C.LEVEL_COUNT; lv++) {
  const st = C.makeLevel(lv);
  const p = C.LV[lv];
  const pre = st.stacks.filter(a => a.length).length, rocks = st.rock.filter(Boolean).length;
  // 目標の後は確認を軽くするため手数に上限
  const goal = st.goal;
  const r = play(Object.assign(C.clone(st), { goal }), 400);
  const ok = r.winAt > 0;
  if (!ok) bad++;
  console.log(`面${lv + 1} R${p[0]} 色${p[1]} 岩${rocks} 最初${pre} 目標${goal} ${ok ? 'クリア ' + r.winAt + '手' : '失敗'} 届いた${r.reach}${r.moves >= 400 ? '+' : ''}`);
}
// エンドレスの目安
for (const seed of [1, 2, 3]) {
  const st = C.makeEndless(seed * 12345);
  const r = play(st, 600);
  console.log(`エンドレス 種${seed} 消した${r.reach}${r.moves >= 600 ? '+' : ''} 手${r.moves}`);
}
console.log(bad ? `NG ${bad} 面が素朴な自動で届かない` : 'OK 全面 素朴な自動でクリア', `(${Date.now() - t0}ms)`);
process.exit(bad ? 1 : 0);
