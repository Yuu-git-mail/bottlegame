// ボトルソートのソルバー (A*)。面が解けるかの検証・最短手数(par)・ヒントに使う。
// 鍵付き瓶(locks)に対応。隠し色は合法手に影響しないので無視してよい。

export interface LockSpec {
  color: number; // この色が 1 本完成すると開く
}

export interface SolveInput {
  bottles: number[][];
  capacities: number[];
  locks?: (LockSpec | null)[];
}

export interface SolveResult {
  solvable: boolean;
  exhausted: boolean; // 探索上限に達して分からなかった
  moves: number;      // 最短手数 (解けた場合)
  expanded: number;   // 展開した状態数 (難しさの目安)
  path: [number, number][]; // 手順 (from, to)
}

interface Node {
  bottles: number[][];
  g: number;
  f: number;
  parent: Node | null;
  move: [number, number] | null;
}

class Heap {
  private a: Node[] = [];
  get size() { return this.a.length; }
  push(n: Node) {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      const t = a[p]; a[p] = a[i]; a[i] = t;
      i = p;
    }
  }
  pop(): Node {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        const t = a[m]; a[m] = a[i]; a[i] = t;
        i = m;
      }
    }
    return top;
  }
}

function isComplete(b: number[], cap: number): boolean {
  if (b.length !== cap) return false;
  for (let i = 1; i < b.length; i++) if (b[i] !== b[0]) return false;
  return true;
}

function isUniform(b: number[]): boolean {
  for (let i = 1; i < b.length; i++) if (b[i] !== b[0]) return false;
  return true;
}

function colorDone(bottles: number[][], caps: number[], color: number): boolean {
  for (let i = 0; i < bottles.length; i++) {
    const b = bottles[i];
    if (b.length === caps[i] && b.length > 0 && b[0] === color && isUniform(b)) return true;
  }
  return false;
}

// 残り手数の下限っぽい見積り: 各瓶の色の切れ目の数
function heuristic(bottles: number[][]): number {
  let h = 0;
  for (const b of bottles) {
    for (let i = 1; i < b.length; i++) if (b[i] !== b[i - 1]) h++;
  }
  return h;
}

// 状態キー。容量と鍵が同じ瓶同士は入れ替えても同じ局面なので並べ替えて縮める
function makeKey(bottles: number[][], groupOf: number[], groups: number): string {
  const parts: string[][] = [];
  for (let g = 0; g < groups; g++) parts.push([]);
  for (let i = 0; i < bottles.length; i++) parts[groupOf[i]].push(bottles[i].join(','));
  let key = '';
  for (let g = 0; g < groups; g++) {
    parts[g].sort();
    key += parts[g].join('|') + '#';
  }
  return key;
}

export function isSolved(bottles: number[][], caps: number[]): boolean {
  for (let i = 0; i < bottles.length; i++) {
    if (bottles[i].length > 0 && !isComplete(bottles[i], caps[i])) return false;
  }
  return true;
}

export function solve(input: SolveInput, budget: number = 60000): SolveResult {
  const caps = input.capacities;
  const n = caps.length;
  const locks = input.locks || [];

  // 同値類: 容量と鍵の内容で分ける
  const groupKeys: string[] = [];
  const groupOf: number[] = [];
  for (let i = 0; i < n; i++) {
    const lk = locks[i] ? 'L' + locks[i]!.color : '-';
    const k = caps[i] + lk;
    let gi = groupKeys.indexOf(k);
    if (gi < 0) { gi = groupKeys.length; groupKeys.push(k); }
    groupOf.push(gi);
  }

  const start: Node = { bottles: input.bottles.map(b => b.slice()), g: 0, f: heuristic(input.bottles), parent: null, move: null };
  if (isSolved(start.bottles, caps)) return { solvable: true, exhausted: false, moves: 0, expanded: 0, path: [] };

  const open = new Heap();
  open.push(start);
  const seen = new Map<string, number>();
  seen.set(makeKey(start.bottles, groupOf, groupKeys.length), 0);
  let expanded = 0;

  while (open.size > 0) {
    const cur = open.pop();
    if (expanded++ > budget) {
      return { solvable: false, exhausted: true, moves: -1, expanded, path: [] };
    }
    const bs = cur.bottles;
    for (let from = 0; from < n; from++) {
      const bf = bs[from];
      if (bf.length === 0) continue;
      if (locks[from] && !colorDone(bs, caps, locks[from]!.color)) continue;
      if (isComplete(bf, caps[from])) continue;
      const color = bf[bf.length - 1];
      let run = 1;
      while (run < bf.length && bf[bf.length - 1 - run] === color) run++;
      const fromUniform = run === bf.length;
      for (let to = 0; to < n; to++) {
        if (to === from) continue;
        const bt = bs[to];
        if (bt.length >= caps[to]) continue;
        if (locks[to] && !colorDone(bs, caps, locks[to]!.color)) continue;
        if (bt.length > 0 && bt[bt.length - 1] !== color) continue;
        if (bt.length === 0 && fromUniform) continue; // 単色の瓶を空へ移すのは無意味
        const space = caps[to] - bt.length;
        const amount = Math.min(run, space);
        if (bt.length === 0 && amount === run && fromUniform) continue;
        const nb = bs.map(b => b.slice());
        for (let k = 0; k < amount; k++) nb[to].push(nb[from].pop()!);
        const g = cur.g + 1;
        const key = makeKey(nb, groupOf, groupKeys.length);
        const prev = seen.get(key);
        if (prev !== undefined && prev <= g) continue;
        seen.set(key, g);
        const node: Node = { bottles: nb, g, f: g + heuristic(nb), parent: cur, move: [from, to] };
        if (isSolved(nb, caps)) {
          const path: [number, number][] = [];
          let p: Node | null = node;
          while (p && p.move) { path.push(p.move); p = p.parent; }
          path.reverse();
          return { solvable: true, exhausted: false, moves: g, expanded, path };
        }
        open.push(node);
      }
    }
  }
  return { solvable: false, exhausted: false, moves: -1, expanded, path: [] };
}
