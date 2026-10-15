// お題の表と全問を確かめる: node games/words/check.mjs
// 表: 語の数(6〜8)・語が表全体で重ならない・よみがひらがな・漢字の語によみがある・also/avoid の id が正しい・言葉遊びの組の語が決まりに合う
// 全問: 16 語が重ならない・よみも重ならない・同じ系統が同居しない・avoid が同居しない・語が他の組にも当てはまらない(also / 言葉遊びの決まり)・面 1〜10 は易しい組だけ
import { readFileSync } from 'fs';
const src = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const core = src.slice(src.indexOf('/*CORE*/'), src.indexOf('/*CORE-END*/'));
const C = new Function(core + '; return WordsCore;')();
const errs = [];
const err = (m) => errs.push(m);

// ---- 表 ----
const allWords = {};
const kanaRe = /^[ぁ-んー]+$/;
const hasKanji = /[^ぁ-んァ-ヶーー]/;
let nWords = 0;
const dCount = { 1: 0, 2: 0, 3: 0 };
for (const c of C.CATS) {
  dCount[c.d]++;
  if (c.words.length < 6 || c.words.length > 8) err(`${c.id}: 語の数 ${c.words.length}`);
  for (const a of c.avoidList) if (!C.byId[a]) err(`${c.id}: avoid の id が無い ${a}`);
  for (const k of Object.keys(c.also)) {
    if (!c.words.some(w => w.t === k)) err(`${c.id}: also の語が表に無い ${k}`);
    for (const id of c.also[k]) if (!C.byId[id]) err(`${c.id}: also の id が無い ${k}→${id}`);
  }
  for (const w of c.words) {
    nWords++;
    if (allWords[w.t]) err(`語の重複: ${w.t} (${allWords[w.t]} と ${c.id})`);
    allWords[w.t] = c.id;
    if (!kanaRe.test(w.r)) err(`${c.id}: よみがひらがなでない ${w.t}|${w.r}`);
    if (hasKanji.test(w.t) && w.r === C.toHira(w.t)) err(`${c.id}: 漢字の語によみが無い ${w.t}`);
    if (c.rule && !C.ruleMatch(c, w)) err(`${c.id}: 決まりに合わない ${w.t}(${w.r})`);
  }
}
// 自分の決まりに当てはまる他カテゴリの語の数(参考)
const ruleHits = {};
for (const c of C.CATS) if (c.rule) {
  ruleHits[c.id] = [];
  for (const o of C.CATS) if (o !== c) for (const w of o.words) if (C.ruleMatch(c, w)) ruleHits[c.id].push(w.t);
}

// ---- 全問 ----
const use = {};
const tagCount = {};
for (let lv = 0; lv < C.LEVEL_COUNT; lv++) {
  const L = C.makeLevel(lv);
  const cats = L.groups.map(g => C.byId[g.id]);
  const tag = `問${lv + 1}`;
  if (L.groups.length !== 4) err(`${tag}: 組の数 ${L.groups.length}`);
  if (L.deal.length !== 16) err(`${tag}: 語の数 ${L.deal.length}`);
  const seenW = {}, seenR = {};
  for (let i = 0; i < 4; i++) {
    const g = L.groups[i], c = cats[i];
    use[c.id] = (use[c.id] || 0) + 1;
    if (lv < 10 && c.d !== 1) err(`${tag}: 面 1〜10 に易しくない組 ${c.n}`);
    if (g.words.length !== 4) err(`${tag}: ${c.n} の語が ${g.words.length}`);
    for (let j = i + 1; j < 4; j++) {
      const o = cats[j];
      const shared = c.tagList.filter(t => o.tagList.includes(t));
      if (shared.length) err(`${tag}: 同じ系統 ${shared} が同居 ${c.n} / ${o.n}`);
      if (c.avoidList.includes(o.id) || o.avoidList.includes(c.id)) err(`${tag}: avoid が同居 ${c.n} / ${o.n}`);
    }
    for (const t of g.words) {
      const w = c.words.find(x => x.t === t);
      if (!w) { err(`${tag}: ${t} が ${c.n} の表に無い`); continue; }
      if (seenW[t]) err(`${tag}: 語の重複 ${t}`);
      if (seenR[w.r]) err(`${tag}: よみの重複 ${t} / ${seenR[w.r]}`);
      seenW[t] = 1; seenR[w.r] = t;
      if (!L.deal.includes(t)) err(`${tag}: 配りに ${t} が無い`);
      for (const o of cats) {
        if (o === c) continue;
        if (w.also.includes(o.id)) err(`${tag}: 当てはまり重複 ${t}(${c.n}) は ${o.n} にも`);
        if (C.ruleMatch(o, w)) err(`${tag}: 当てはまり重複 ${t}(${c.n}) は ${o.n} の決まりにも合う`);
      }
    }
  }
  // 判定: 正解の組は通り、わざと混ぜた組は通らない
  const solved = [];
  for (let g = 0; g < 4; g++) {
    const mixSel = L.groups[g].words.slice(0, 3).concat([L.groups[(g + 1) % 4].words[0]]);
    const r1 = C.judge(L, mixSel, solved);
    if (r1.ok >= 0 || !r1.near) err(`${tag}: 混ぜた組の判定がおかしい`);
    const r = C.judge(L, L.groups[g].words, solved);
    if (r.ok !== g) err(`${tag}: 正解の組 ${g} が通らない`);
    solved.push(g);
  }
  const d = cats.map(c => c.d).join('');
  console.log(`問${String(lv + 1).padStart(2)} [${d}] ` + L.groups.map(g => `${g.n}(${g.words.join('・')})`).join(' / '));
}
// 同じ組み合わせ(4 カテゴリ)が 2 問に出ていないか
const combos = {};
for (let lv = 0; lv < C.LEVEL_COUNT; lv++) {
  const k = C.makeLevel(lv).groups.map(g => g.id).sort().join(',');
  if (combos[k]) err(`問${lv + 1}: 問${combos[k]} と同じ組み合わせ`);
  combos[k] = lv + 1;
}
const unused = C.CATS.filter(c => !use[c.id]).map(c => c.n);
console.log(`表: カテゴリ ${C.CATS.length}(易 ${dCount[1]} / 中 ${dCount[2]} / 言葉遊び ${dCount[3]})、語 ${nWords}`);
console.log(`使われたカテゴリ ${C.CATS.length - unused.length}${unused.length ? '、未使用: ' + unused.join(' ') : ''}、最多 ${Math.max(...Object.values(use))} 回`);
for (const k of Object.keys(ruleHits)) console.log(`決まり ${C.byId[k].n} に当たる他の語: ${ruleHits[k].join(' ') || 'なし'}`);
if (errs.length) { console.log('NG ' + errs.length); errs.slice(0, 60).forEach(e => console.log('  ' + e)); process.exit(1); }
console.log(`OK 全 ${C.LEVEL_COUNT} 問`);
