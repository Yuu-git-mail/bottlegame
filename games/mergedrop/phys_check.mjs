// 物理だけを node で回す試験: node games/mergedrop/phys_check.mjs
// 1) 自動で落とし続けて線を越えるまで遊ばせ、毎フレーム 玉が箱の外に出ない・NaN が出ないことを確かめる。
// 2) 試合の途中(20 秒ごと)の形を写し取り、落とすのを止めて 20 秒以内に箱ごと静止する(眠る)ことを確かめる。
//    (遅い合体の連鎖や転がりがあるので 20 秒。10 秒以内に止まった割合と中央値も出す)
//    眠った後 2 秒回しても位置が動かない(震えない)ことも見る。
// 3) 合体しない玉を 90 個詰めた形で 1 フレームの重さを測る。
import { readFileSync } from 'fs';
const src = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const core = src.slice(src.indexOf('/*CORE*/'), src.indexOf('/*CORE-END*/'));
const C = new Function(core + '; return MergeCore;')();

function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// 形を写し取る(玉の参照を作り直す)
function clone(w) {
  const w2 = C.create();
  for (const b of w.balls) { const nb = Object.assign({}, b); w2.balls.push(nb); w2.order.push(nb); }
  w2.nextId = w.nextId;
  return w2;
}
// 落とさずに回して、眠るまでのフレーム数と眠った後の最大移動
function settle(w) {
  let at = -1, errs = [];
  for (let f = 0; f < 1200; f++) {
    C.step(w); C.step(w);
    const e = C.check(w); if (e.length && !errs.length) errs.push(e[0]);
    if (at < 0 && w.sleep) at = f;
  }
  const snap = w.balls.map(b => [b.x, b.y]);
  for (let k = 0; k < 240; k++) C.step(w);
  let mv = 0;
  w.balls.forEach((b, i) => { mv = Math.max(mv, Math.hypot(b.x - snap[i][0], b.y - snap[i][1])); });
  return { at, mv, errs };
}

const FRAME = 1 / 60, GAMES = 12;
let bad = 0, worstMs = 0, totalFrames = 0, cps = 0, cpBad = 0, settleTimes = [];
for (let g = 0; g < GAMES; g++) {
  const r = rng(1000 + g);
  const w = C.create();
  const smart = g % 3 !== 2; // 3 回に 1 回はでたらめな位置
  let frames = 0, drops = 0, maxBalls = 0, errs = [], cpNote = [];
  while (!w.over && frames < 30000) {
    if (frames % 40 === 0) {
      const t = C.randTier(r);
      C.drop(w, smart ? C.autoPick(w, t, r) : C.BOX.L + r() * (C.BOX.R - C.BOX.L), t);
      drops++;
    }
    const t0 = performance.now();
    C.update(w, FRAME);
    const ms = performance.now() - t0;
    if (frames > 10 && ms > worstMs) worstMs = ms;
    frames++;
    if (w.balls.length > maxBalls) maxBalls = w.balls.length;
    const e = C.check(w);
    if (e.length && errs.length < 3) errs.push('f' + frames + ' ' + e[0]);
    if (frames % 1200 === 0 && !w.over) {
      const s = settle(clone(w));
      cps++; settleTimes.push(s.at);
      const ok = s.at >= 0 && s.mv < 0.01 && !s.errs.length;
      if (!ok) { cpBad++; cpNote.push(`${frames}f: 静止${s.at < 0 ? 'せず' : s.at + 'f'} 動き${s.mv.toFixed(2)}px ${s.errs.join('')}`); }
    }
  }
  totalFrames += frames;
  if (errs.length || cpNote.length) bad++;
  console.log(`試合${g + 1}${smart ? '' : '(でたらめ)'} ${(frames / 60).toFixed(0)}秒 落下${drops} 合体${w.merges} 最大段${w.maxTier} 最多玉${maxBalls} 点${w.score} ${w.over ? '線を越えて終わり' : '時間切れ'}` +
    `${errs.length ? ' NG ' + errs.join(' / ') : ''}${cpNote.length ? ' 静止NG ' + cpNote.join(' / ') : ''}`);
}

// 合体しない玉を 90 個詰めた形の重さ
{
  const w = C.create();
  const r = rng(7);
  for (let i = 0; i < 90; i++) {
    const b = C.drop(w, C.BOX.L + r() * (C.BOX.R - C.BOX.L), i % 3);
    b.y = 60 + Math.floor(i / 9) * 30; b.t = 100 + i; // 段を全部別にして合体させない
  }
  w.overT = -1e9;
  let worst = 0, sum = 0;
  for (let f = 0; f < 600; f++) {
    const t0 = performance.now();
    C.step(w); C.step(w);
    const ms = performance.now() - t0; sum += ms; if (f > 10 && ms > worst) worst = ms;
    const e = C.check(w); if (e.length) { bad++; console.log('詰め込み NG', e[0]); break; }
  }
  console.log(`詰め込み ${w.balls.length}玉 1フレーム平均${(sum / 600).toFixed(3)}ms 最大${worst.toFixed(2)}ms 眠った玉${w.balls.filter(b => b.sleep).length}`);
}
const okT = settleTimes.filter(t => t >= 0).sort((a, b) => a - b);
console.log(`静止まで 10 秒以内 ${okT.filter(t => t < 600).length}/${cps} 中央値 ${(okT[okT.length >> 1] / 60).toFixed(1)}秒 最長 ${(okT[okT.length - 1] / 60).toFixed(1)}秒`);
console.log(`合計 ${(totalFrames / 60 / 60).toFixed(1)} 分ぶん(${totalFrames * 2} 段階) 途中の静止確認 ${cps - cpBad}/${cps} 試合中の 1 フレーム最大 ${worstMs.toFixed(2)}ms`);
console.log(bad ? `NG ${bad}` : 'OK 箱から出ない・NaN なし・途中の形は止まって震えない');
process.exit(bad ? 1 : 0);
