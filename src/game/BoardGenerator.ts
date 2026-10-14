import { Rng } from './Rng';
import { solve, LockSpec } from './Solver';
import { specFor, LevelSpec, CLASSIC_MAX } from './Levels';
import { BAKED_LEVELS } from './BakedLevels';

export interface Board {
  bottles: number[][];
  capacities: number[];
  hidden?: number[];
  locks?: (LockSpec | null)[];
  moveLimit?: number | null;
  par?: number | null;
  theme?: string;
}

export const MAX_COLORS = 12;

export class BoardGenerator {
  // 1〜20 面: 従来どおり (変更しない)
  static generate(level: number): { bottles: number[][], capacities: number[] } {
    const colorCount = Math.min(4 + Math.floor((level - 1) / 2), 12);
    const emptyBottles = 2;

    const capacities: number[] = [];
    const bottles: number[][] = [];

    // Choose capacities for filled bottles
    for (let i = 0; i < colorCount; i++) {
      let cap = 4;
      if (level >= 3) cap = Math.random() < 0.3 ? 3 : (Math.random() < 0.5 ? 5 : 4);
      if (level >= 5 && Math.random() < 0.2) cap = 6;
      capacities.push(cap);
      bottles.push(Array(cap).fill(i));
    }

    // Choose capacities for empty bottles
    for (let i = 0; i < emptyBottles; i++) {
      let cap = 4;
      if (level >= 3) cap = Math.random() < 0.5 ? 4 : 5;
      capacities.push(cap);
      bottles.push([]);
    }

    // Reverse pour logic
    const shuffles = colorCount * 50;
    for (let i = 0; i < shuffles; i++) {
      const from = Math.floor(Math.random() * bottles.length);
      const to = Math.floor(Math.random() * bottles.length);

      if (from !== to && bottles[from].length > 0 && bottles[to].length < capacities[to]) {
         const amount = Math.floor(Math.random() * Math.min(bottles[from].length, capacities[to] - bottles[to].length)) + 1;

         for(let j=0; j<amount; j++){
           if(bottles[from].length > 0){
             bottles[to].push(bottles[from].pop()!);
           }
         }
      }
    }

    return { bottles, capacities };
  }

  // 面番号に応じた盤面。21 以降は種付き乱数 + ソルバー検証
  static board(level: number): Board {
    if (level <= CLASSIC_MAX) return BoardGenerator.generate(level);
    const spec = specFor(level);
    const baked = BAKED_LEVELS[level];
    if (baked) {
      const b = BoardGenerator.build(spec, baked[0]);
      b.par = baked[1];
      if (spec.moveLimitSlack !== null) b.moveLimit = baked[1] + spec.moveLimitSlack;
      return b;
    }
    // 焼いていない面: その場で検証しながら作る
    const found = BoardGenerator.search(level, 40, 30000);
    if (found) return found;
    // 見つからなければ最後の候補をそのまま (理論上は逆注ぎなので解ける)
    const b = BoardGenerator.build(spec, 0);
    b.par = null;
    b.moveLimit = null;
    return b;
  }

  // attempt を変えながら、解けて十分に難しい盤面を探す
  static search(level: number, maxAttempts: number, budget: number): Board | null {
    const spec = specFor(level);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const b = BoardGenerator.build(spec, attempt);
      const r = solve({ bottles: b.bottles, capacities: b.capacities, locks: b.locks }, budget);
      if (!r.solvable) continue;
      if (r.moves < spec.minMoves) continue;
      b.par = r.moves;
      if (spec.moveLimitSlack !== null) b.moveLimit = r.moves + spec.moveLimitSlack;
      (b as any).attempt = attempt;
      (b as any).expanded = r.expanded;
      return b;
    }
    return null;
  }

  // 仕様と試行番号から盤面を組む (決定的)
  static build(spec: LevelSpec, attempt: number): Board {
    const rng = new Rng(spec.level * 7919 + attempt * 104729 + 17);
    const colors = Math.min(spec.colors, MAX_COLORS);
    const capacities: number[] = [];
    const bottles: number[][] = [];
    const locks: (LockSpec | null)[] = [];

    // 色の入った瓶
    for (let c = 0; c < colors; c++) {
      let cap = spec.capacity;
      if (spec.tallMix) {
        const r = rng.next();
        cap = r < 0.3 ? 5 : (r < 0.45 ? 6 : 4);
      }
      capacities.push(cap);
      bottles.push(Array(cap).fill(c));
      locks.push(null);
    }
    // 空き瓶
    for (let e = 0; e < spec.empties; e++) {
      capacities.push(spec.tallMix && rng.next() < 0.5 ? 5 : spec.capacity);
      bottles.push([]);
      locks.push(null);
    }
    // 鍵付きの空き瓶: 鍵の色は後で決める
    const lockIdx: number[] = [];
    for (let e = 0; e < spec.lockedEmpties; e++) {
      capacities.push(spec.capacity);
      bottles.push([]);
      locks.push(null);
      lockIdx.push(bottles.length - 1);
    }

    // 逆注ぎで混ぜる。鍵付き瓶は混ぜる間は使わない (開始時に空であるため)
    const usable = bottles.length - lockIdx.length;
    const shuffles = colors * 60;
    for (let i = 0; i < shuffles; i++) {
      const from = rng.int(usable);
      const to = rng.int(usable);
      if (from === to) continue;
      if (bottles[from].length === 0 || bottles[to].length >= capacities[to]) continue;
      const maxAmount = Math.min(bottles[from].length, capacities[to] - bottles[to].length);
      // 少量ずつ移すほど混ざる
      const amount = 1 + rng.int(Math.min(maxAmount, 2));
      for (let j = 0; j < amount; j++) bottles[to].push(bottles[from].pop()!);
    }

    // 空き瓶の中身を色瓶へ戻して、開始時の空き瓶を確保する
    for (let e = colors; e < usable; e++) {
      let guard = 0;
      while (bottles[e].length > 0 && guard++ < 200) {
        const color = bottles[e][bottles[e].length - 1];
        // 入る先: 色瓶で空きがあるところ (同色の上でなくてもよい: 逆注ぎなので)
        const cands: number[] = [];
        for (let c = 0; c < colors; c++) if (bottles[c].length < capacities[c]) cands.push(c);
        if (cands.length === 0) break;
        // なるべく同じ色の上には置かない (混ざり具合を保つ)
        const notSame = cands.filter(c => bottles[c].length === 0 || bottles[c][bottles[c].length - 1] !== color);
        const target = (notSame.length > 0 ? rng.pick(notSame) : rng.pick(cands));
        bottles[target].push(bottles[e].pop()!);
      }
    }

    // 最初から完成している瓶や、単色で満杯の瓶があれば崩す
    for (let c = 0; c < colors; c++) {
      const b = bottles[c];
      if (b.length === capacities[c] && b.every(x => x === b[0])) {
        // 別の瓶と上 1 層ずつ交換
        const other = (c + 1 + rng.int(colors - 1)) % colors;
        const t1 = b.pop()!;
        const t2 = bottles[other].pop();
        if (t2 !== undefined) b.push(t2);
        bottles[other].push(t1);
      }
    }

    // 鍵の色: 開始時に一番そろえやすそうな色 (上に出ている数が多い色) を避け、中程度の色にする
    if (lockIdx.length > 0) {
      const topCount = new Array(colors).fill(0);
      for (let i = 0; i < usable; i++) {
        const b = bottles[i];
        if (b.length > 0) topCount[b[b.length - 1]]++;
      }
      const order = topCount.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map(p => p[1]);
      lockIdx.forEach((li, k) => {
        locks[li] = { color: order[Math.min(order.length - 1, 1 + k)] };
      });
    }

    // 隠し層
    let hidden: number[] | undefined;
    if (spec.hiddenDepth > 0) {
      hidden = bottles.map((b, i) => {
        if (i >= colors) return 0;
        const depth = spec.hiddenDepth >= 99 ? b.length - 1 : Math.min(spec.hiddenDepth, b.length - 1);
        return Math.max(0, depth);
      });
    }

    return { bottles, capacities, hidden, locks, moveLimit: null, par: null, theme: spec.theme };
  }
}
