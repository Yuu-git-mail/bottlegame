// 砂の更新の確かめ: node games/sand/check.mjs
// 1) 数千ステップ回して、粒の数が消去以外で増減しないこと
// 2) 左端から右端までのつながりの判定(つながる/つながらない)
// 3) 自動の手で色の数 3〜5 を遊ばせ、消去・連鎖が起き、数の帳尻が合うこと
import { readFileSync } from 'fs';
const src = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const core = src.slice(src.indexOf('/*CORE*/'), src.indexOf('/*CORE-END*/'));
const C = new Function(core + '; return SandCore;')();
const { W, H } = C;
let bad = 0;
const ng = (m) => { bad++; console.log('NG ' + m); };

// 1) 保存則
{
  const rnd = C.rng(7);
  const g = C.create(99);
  let steps = 0, placed = 0, cleared = 0, maxMoved = 0, stepFail = 0;
  const T0 = Date.now();
  for (; steps < 6000; steps++) {
    if (steps % 23 === 0) {
      const p = C.makePiece(rnd, 4);
      placed += C.place(g, p, Math.floor(rnd() * (W - p.w + 1)));
    }
    const before = C.count(g);
    const m = C.step(g);
    if (m > maxMoved) maxMoved = m;
    if (C.count(g) !== before) stepFail++;
    // 時々消去も混ぜる(光っている間も数は変わらない、消すと消えた分だけ減る)
    if (steps % 50 === 0) {
      const r = C.findClears(g);
      if (r.count) {
        const b2 = C.count(g);
        for (let k = 0; k < 20; k++) { const bb = C.count(g); C.step(g); if (C.count(g) !== bb) stepFail++; }
        const n = C.removeFlash(g);
        if (n !== r.count || C.count(g) !== b2 - n) ng('消した数が合わない');
        cleared += n;
      }
    }
    if (C.count(g) !== placed - cleared) { ng('帳尻 step ' + steps); break; }
    // 粒の無い所に濃淡や印が残っていないか
    if (steps % 500 === 0) for (let i = 0; i < W * H; i++) if (!g.c[i] && (g.s[i] || g.f[i])) { ng('空きに濃淡/印 ' + i); break; }
  }
  if (stepFail) ng('step で数が変わった回数 ' + stepFail);
  console.log(`保存則: ${steps} ステップ 置いた ${placed} 消した ${cleared} 残り ${C.count(g)} 1 ステップ最大移動 ${maxMoved} ${Date.now() - T0}ms ${stepFail ? 'NG' : 'OK'}`);
}

// 1b) 止まること(置いた後、十分回せば動かなくなる)
{
  const rnd = C.rng(3), g = C.create(5);
  for (let k = 0; k < 6; k++) { const p = C.makePiece(rnd, 3); C.place(g, p, Math.floor(rnd() * (W - p.w + 1))); for (let s = 0; s < 40; s++) C.step(g); }
  let s = 0; while (s < 2000 && C.step(g) > 0) s++;
  if (s >= 2000) ng('止まらない');
  console.log(`止まる: ${s} ステップで静止 ${s < 2000 ? 'OK' : 'NG'}`);
}

// 2) つながりの判定
{
  const g = C.create(1);
  for (let y = H - 4; y < H; y++) for (let x = 0; x < W; x++) g.c[y * W + x] = 1;
  const r = C.findClears(g);
  if (r.count !== W * 4) ng('横一列 4 段が ' + r.count);
  const g2 = C.create(1);
  for (let y = H - 4; y < H; y++) for (let x = 0; x < W - 1; x++) g2.c[y * W + x] = 1;
  if (C.findClears(g2).count !== 0) ng('右端に届かないのに消えた');
  const g3 = C.create(1); // 斜めにつながる階段(8 近傍なら消える)
  for (let x = 0; x < W; x++) g3.c[(H - 1 - (x % 2)) * W + x] = 2;
  if (C.findClears(g3).count !== W) ng('斜めつながり');
  const g4 = C.create(1); // 別の色が間に 1 列
  for (let y = H - 4; y < H; y++) for (let x = 0; x < W; x++) g4.c[y * W + x] = x === 40 ? 2 : 1;
  if (C.findClears(g4).count !== 0) ng('色の切れ目を越えた');
  console.log('判定: 横一列・届かない・斜め・切れ目 ' + (bad ? '' : 'OK'));
}

// 3) 自動で遊ばせる(画面と同じ流れ: 回す→消去を探す→光る→消す→止まって線より上なら終わり)
function play(ncol, seed, maxPieces) {
  const rnd = C.rng(seed), g = C.create(seed);
  let pieces = [C.makePiece(rnd, ncol), C.makePiece(rnd, ncol), C.makePiece(rnd, ncol)];
  let placed = 0, cleared = 0, clears = 0, maxChain = 0, chain = 0, score = 0, nPieces = 0, flash = 0, settled = true, end = '上限';
  for (let t = 0; t < 400000; t++) {
    settled = C.step(g) === 0;
    if (t % 3) continue; // 画面と同じく 1 フレーム(約 3 ステップ)ごとに判定
    if (flash > 0) { if ((flash -= 3) <= 0) { flash = 0;  cleared += C.removeFlash(g); settled = false; } }
    else {
      const r = C.findClears(g);
      if (r.count) { chain++; clears++; score += r.count * chain; if (chain > maxChain) maxChain = chain; flash = 90; }
      else if (settled) { chain = 0; if (C.highest(g) < C.LINE) { end = 'あふれ'; break; } if (!C.anyPlace(g, pieces)) { end = '置けない'; break; } }
    }
    if (flash === 0 && t % 60 === 0 && (settled || C.topFree(g, 40))) {
      if (nPieces >= maxPieces) { if (settled) break; continue; }
      const mv = C.chooseMove(g, pieces);
      if (!mv) continue;
      placed += C.place(g, pieces[mv.i], mv.x);
      pieces[mv.i] = C.makePiece(rnd, ncol);
      nPieces++;
    }
    if (t % 120 === 0 && C.count(g) !== placed - cleared) { ng(`帳尻 色${ncol} 種${seed}`); break; }
  }
  return { nPieces, clears, maxChain, score, end, left: C.count(g) };
}
if (process.env.AI) Object.assign(C.AI, JSON.parse(process.env.AI));
const MAXP = +(process.env.MAXP || 200);
for (const ncol of [3, 4, 5]) {
  const rs = [];
  for (const seed of [1, 2, 3, 4]) rs.push(play(ncol, seed, MAXP));
  const avg = (k) => (rs.reduce((a, r) => a + r[k], 0) / rs.length).toFixed(1);
  console.log(`自動 ${ncol}色: ピース ${avg('nPieces')} 消去 ${avg('clears')} 最大連鎖 ${Math.max(...rs.map(r => r.maxChain))} 点 ${avg('score')} 終わり方 ${rs.map(r => r.end).join('/')}`);
  if (rs.every(r => r.clears === 0)) ng(ncol + '色で一度も消えない');
}
console.log(bad ? `NG ${bad}` : 'OK');
process.exit(bad ? 1 : 0);
