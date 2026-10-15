// 全面を自動の振り方で回し、勝てるか・易しすぎないかを確かめる（論理の CORE ブロックだけを node で回す）
//   node games/cannon/check.mjs          … 確かめる
//   node games/cannon/check.mjs --bake   … 条件を満たす配りを面ごとに探し、index.html の SEEDS を書き換える
import { readFileSync, writeFileSync } from 'fs';
const file = new URL('./index.html', import.meta.url);
let src = readFileSync(file, 'utf8');
const load = () => new Function(src.slice(src.indexOf('/*CORE*/'), src.indexOf('/*CORE-END*/')) + '; return CannonCore;')();
let C = load();

// 振り方。sweep(速さ, 位相) は左右に振る。edge はゲートを使わない端撃ち
const sweep = (sp, ph) => S => ({ x: C.W / 2 + (C.W / 2 - 24) * Math.sin(S.t * sp + ph), fire: true, big: S.gauge >= C.GAUGE_MAX });
const edge = S => ({ x: 18, fire: true, big: S.gauge >= C.GAUGE_MAX });
const hpf = S => S.result === 'win' ? S.playerHp / S.def.playerHp : -1;

// 面ごとの狙い: 自動(画面の auto と同じ振り方)で残る HP の割合の幅
function band(lv) {
  if (lv < 8) return [0.8, 1];
  if (lv < 14) return [0.55, 1];
  if (lv < 20) return [0.4, 0.97];
  return [0.15, 0.9];
}
function judge(lv, v) {
  const a = C.simulate(lv, C.autoInput, 300, v);
  const s2 = C.simulate(lv, sweep(0.6, 1.7), 300, v);   // 振り方を変えても勝てる(偶然の噛み合わせではない)
  const s3 = C.simulate(lv, sweep(1.3, 4.0), 300, v);
  const e = C.simulate(lv, edge, 300, v);
  const [lo, hi] = band(lv);
  const msg = [];
  if (a.result !== 'win') msg.push('自動で勝てない');
  else if (hpf(a) < lo || hpf(a) > hi) msg.push(`残HP ${Math.round(hpf(a) * 100)}% が狙い ${lo * 100}〜${hi * 100}% の外`);
  if (s2.result !== 'win' && s3.result !== 'win') msg.push('振り方を変えると勝てない');
  if (lv >= 3 && e.result === 'win') msg.push('ゲート無しで勝てる');
  if (a.result === 'win' && (a.t > 120 || (lv >= 10 && a.t < 15))) msg.push(`時間 ${Math.round(a.t)} 秒`);
  return { a, s2, s3, e, msg };
}

if (process.argv.includes('--bake')) {
  const seeds = [];
  for (let lv = 0; lv < C.LEVEL_COUNT; lv++) {
    let got = -1;
    for (let v = 0; v < 400 && got < 0; v++) if (!judge(lv, v).msg.length) got = v;
    if (got < 0) { console.log(`面${lv + 1}: 条件を満たす配りが見つからない`); got = 0; }
    seeds.push(got);
  }
  src = src.replace(/var SEEDS = \[[^\]]*\];/, `var SEEDS = [${seeds.join(', ')}];`);
  writeFileSync(file, src);
  C = load();
  console.log('SEEDS', seeds.join(','));
}

let bad = 0, maxBlue = 0;
const t0 = Date.now();
const r = S => S.result === 'win' ? `勝${C.stars(S)}★ ${Math.round(S.t)}秒 HP${S.playerHp}` : (S.result === 'lose' ? `負 敵残${S.enemyHp}` : `時間切れ`);
for (let lv = 0; lv < C.LEVEL_COUNT; lv++) {
  const d = C.makeLevel(lv);
  let peak = 0;
  C.simulate(lv, S => { if (S.bn > peak) peak = S.bn; return C.autoInput(S); }, 300);
  maxBlue = Math.max(maxBlue, peak);
  const j = judge(lv);
  if (j.msg.length) bad++;
  const gates = d.gates.map(g => (g.kind === 'mul' ? 'x' : '+') + g.val + (g.amp ? '~' : '') + (g.maxUses > 0 ? `(${g.maxUses})` : '')).join(' ');
  console.log(`面${lv + 1} 敵HP${d.enemyHp} [${gates}] 自動: ${r(j.a)} 青最大${peak} / 別の振り: ${r(j.s2)}, ${r(j.s3)} / 端: ${r(j.e)}${j.msg.length ? ' ← ' + j.msg.join('・') : ''}`);
}
console.log(`青の最大 ${maxBlue}（上限 ${C.BLUE_CAP}）、所要 ${Date.now() - t0}ms`);
console.log(bad ? `NG ${bad}` : 'OK 全面: 自動で勝てる・振り方を変えても勝てる・残HPが面ごとの狙いの幅・ゲート無しでは勝てない(4 面目から)');
process.exit(bad ? 1 : 0);
