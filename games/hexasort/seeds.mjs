// 面ごとの種のずらし(SEED_OFF)を選び直して index.html に書き込む: node games/hexasort/seeds.mjs
// 素朴な自動(autoMove)が目標の 1.2 倍以上まで届く、いちばん小さいずらしを選ぶ。
// 面の設定(LV)を変えたらこれを流し、続けて check.mjs で確かめる。
import { readFileSync, writeFileSync } from 'fs';
const path = new URL('./index.html', import.meta.url);
let src = readFileSync(path, 'utf8');
const core = src.slice(src.indexOf('/*CORE*/'), src.indexOf('/*CORE-END*/'));
const C = new Function(core + '; return HexaCore;')();
const MARGIN = 1.2, MAX_OFF = 400;

function reach(lv, off, need) {
  const st = C.makeLevel(lv, off);
  st.goal = Infinity;
  let m = 0;
  while (m < 600 && st.cleared < need && C.emptyCells(st).length) {
    const mv = C.autoMove(st);
    C.place(st, mv.ti, mv.cell);
    m++;
  }
  return st.cleared;
}
const offs = [];
for (let lv = 0; lv < C.LEVEL_COUNT; lv++) {
  const need = Math.ceil(C.LV[lv][4] * MARGIN);
  let found = -1, best = -1, bestOff = 0;
  for (let off = 0; off < MAX_OFF; off++) {
    const r = reach(lv, off, need);
    if (r >= need) { found = off; break; }
    if (r > best) { best = r; bestOff = off; }
  }
  if (found < 0) console.log(`面${lv + 1} 見つからない(最高 ${best} / 必要 ${need}、ずらし ${bestOff})`);
  else console.log(`面${lv + 1} ずらし ${found}`);
  offs.push(found < 0 ? bestOff : found);
}
src = src.replace(/\/\*SEEDS\*\/[^/]*\/\*SEEDS-END\*\//, '/*SEEDS*/' + offs.join(', ') + '/*SEEDS-END*/');
writeFileSync(path, src);
console.log('書き込み済み');
