import { LockSpec } from './Solver';

export interface Snapshot {
  bottles: number[][];
  hidden: number[];
  score: number;
}

export interface StateOptions {
  hidden?: number[];            // 瓶ごとの隠し層の数 (下から数える)
  locks?: (LockSpec | null)[];  // 鍵付き瓶
  moveLimit?: number | null;    // 手数制限 (null = なし)
  par?: number | null;          // 最短手数 (星の基準)
}

export class GameState {
  bottles: number[][];
  capacities: number[];
  initialBottles: number[][];
  initialCapacities: number[];
  initialHidden: number[];
  hidden: number[];
  locks: (LockSpec | null)[];
  moveLimit: number | null;
  par: number | null;
  history: Snapshot[];
  score: number;
  moves: number;
  level: number;
  addedBottles: number;

  constructor(bottles: number[][], capacities: number[], level: number = 1, opts: StateOptions = {}) {
    this.bottles = bottles.map(b => [...b]);
    this.capacities = [...capacities];
    this.initialBottles = bottles.map(b => [...b]);
    this.initialCapacities = [...capacities];
    this.hidden = bottles.map((b, i) => Math.min((opts.hidden && opts.hidden[i]) || 0, Math.max(0, b.length - 1)));
    this.initialHidden = [...this.hidden];
    this.locks = bottles.map((_, i) => (opts.locks && opts.locks[i]) || null);
    this.moveLimit = opts.moveLimit === undefined ? null : opts.moveLimit;
    this.par = opts.par === undefined ? null : opts.par;
    this.history = [];
    this.score = 0;
    this.moves = 0;
    this.level = level;
    this.addedBottles = 0;
  }

  restartToInitial() {
    this.bottles = this.initialBottles.map(b => [...b]);
    this.capacities = [...this.initialCapacities];
    this.hidden = [...this.initialHidden];
    this.locks = this.locks.slice(0, this.initialBottles.length);
    this.history = [];
    this.moves = 0;
    this.addedBottles = 0;
  }

  get hasHidden(): boolean {
    return this.initialHidden.some(h => h > 0);
  }

  get hasLocks(): boolean {
    return this.locks.some(l => !!l);
  }

  isColorDone(color: number): boolean {
    for (let i = 0; i < this.bottles.length; i++) {
      const b = this.bottles[i];
      if (b.length > 0 && b.length === this.capacities[i] && b[0] === color && b.every(c => c === color)) return true;
    }
    return false;
  }

  isLocked(i: number): boolean {
    const l = this.locks[i];
    return !!l && !this.isColorDone(l.color);
  }

  isHiddenLayer(bottle: number, layer: number): boolean {
    return layer < (this.hidden[bottle] || 0);
  }

  // 上から続く同色の層の数 (隠し層は含めない)
  topRun(i: number): number {
    const b = this.bottles[i];
    if (b.length === 0) return 0;
    const color = b[b.length - 1];
    const hid = this.hidden[i] || 0;
    let run = 0;
    for (let k = b.length - 1; k >= hid; k--) {
      if (b[k] !== color) break;
      run++;
    }
    return Math.max(1, run);
  }

  canPour(from: number, to: number): boolean {
    if (from === to) return false;
    const bFrom = this.bottles[from];
    const bTo = this.bottles[to];
    if (!bFrom || !bTo) return false;
    if (bFrom.length === 0) return false;
    if (this.isLocked(from) || this.isLocked(to)) return false;
    if (bTo.length >= this.capacities[to]) return false;
    if (bTo.length === 0) return true;
    return bFrom[bFrom.length - 1] === bTo[bTo.length - 1];
  }

  // 実際に移る量
  pourAmount(from: number, to: number): number {
    if (!this.canPour(from, to)) return 0;
    const run = this.topRun(from);
    const space = this.capacities[to] - this.bottles[to].length;
    return Math.min(run, space);
  }

  pour(from: number, to: number): boolean {
    const amount = this.pourAmount(from, to);
    if (amount <= 0) return false;

    this.saveState();

    const bFrom = this.bottles[from];
    const bTo = this.bottles[to];
    for (let k = 0; k < amount; k++) bTo.push(bFrom.pop() as number);
    // 隠し層が最上段になったら見えるようにする
    if ((this.hidden[from] || 0) > Math.max(0, bFrom.length - 1)) {
      this.hidden[from] = Math.max(0, bFrom.length - 1);
    }
    this.moves++;
    return true;
  }

  get movesLeft(): number | null {
    if (this.moveLimit === null) return null;
    return this.moveLimit - this.moves;
  }

  isOutOfMoves(): boolean {
    return this.moveLimit !== null && this.moves >= this.moveLimit && !this.isWin();
  }

  addEmptyBottle() {
    this.saveState();
    this.bottles.push([]);
    this.capacities.push(4);
    this.hidden.push(0);
    this.locks.push(null);
    this.addedBottles++;
  }

  saveState() {
    this.history.push({
      bottles: this.bottles.map(b => [...b]),
      hidden: [...this.hidden],
      score: this.score
    });
  }

  undo(): boolean {
    if (this.history.length === 0) return false;
    const last = this.history.pop()!;
    // 追加した瓶を戻す場合
    while (this.bottles.length > last.bottles.length) {
      this.bottles.pop();
      this.capacities.pop();
      this.hidden.pop();
      this.locks.pop();
      this.addedBottles = Math.max(0, this.addedBottles - 1);
    }
    this.bottles = last.bottles.map(b => [...b]);
    this.hidden = [...last.hidden];
    this.score = last.score;
    if (this.moves > 0) this.moves--;
    return true;
  }

  isWin(): boolean {
    for (let i = 0; i < this.bottles.length; i++) {
      const b = this.bottles[i];
      if (b.length > 0) {
        if (b.length !== this.capacities[i]) return false;
        if ((this.hidden[i] || 0) > 0) return false;
        const color = b[0];
        if (!b.every(c => c === color)) return false;
      }
    }
    return true;
  }

  isBottleComplete(index: number): boolean {
    const b = this.bottles[index];
    if (b.length === 0) return false;
    if (b.length !== this.capacities[index]) return false;
    if ((this.hidden[index] || 0) > 0) return false;
    return b.every(c => c === b[0]);
  }

  // 合法手が 1 つも無い (詰み)
  isStuck(): boolean {
    if (this.isWin()) return false;
    for (let f = 0; f < this.bottles.length; f++) {
      if (this.bottles[f].length === 0 || this.isBottleComplete(f)) continue;
      for (let t = 0; t < this.bottles.length; t++) {
        if (f !== t && this.canPour(f, t)) {
          // 単色の瓶を空へ移すだけの手は進展が無いので除く
          const bf = this.bottles[f];
          const uniform = bf.every(c => c === bf[0]) && (this.hidden[f] || 0) === 0;
          if (this.bottles[t].length === 0 && uniform) continue;
          return false;
        }
      }
    }
    return true;
  }

  toJSON() {
    return {
      level: this.level,
      bottles: this.bottles,
      capacities: this.capacities,
      initialBottles: this.initialBottles,
      initialCapacities: this.initialCapacities,
      initialHidden: this.initialHidden,
      hidden: this.hidden,
      locks: this.locks,
      moveLimit: this.moveLimit,
      par: this.par,
      moves: this.moves,
      score: this.score,
      history: this.history,
      addedBottles: this.addedBottles
    };
  }

  // 保存データから復元。古い形式 (v1: hidden/locks 無し) も受け付ける
  static fromJSON(data: any): GameState | null {
    if (!data || !Array.isArray(data.bottles) || !Array.isArray(data.capacities)) return null;
    const level = typeof data.level === 'number' ? data.level : 1;
    const initB: number[][] = Array.isArray(data.initialBottles) ? data.initialBottles : data.bottles;
    const initC: number[] = Array.isArray(data.initialCapacities) ? data.initialCapacities : data.capacities;
    const st = new GameState(initB, initC, level, {
      hidden: Array.isArray(data.initialHidden) ? data.initialHidden : undefined,
      locks: Array.isArray(data.locks) ? data.locks.slice(0, initB.length) : undefined,
      moveLimit: typeof data.moveLimit === 'number' ? data.moveLimit : null,
      par: typeof data.par === 'number' ? data.par : null
    });
    st.bottles = data.bottles.map((b: number[]) => [...b]);
    st.capacities = [...data.capacities];
    while (st.hidden.length < st.bottles.length) st.hidden.push(0);
    while (st.locks.length < st.bottles.length) st.locks.push(null);
    if (Array.isArray(data.hidden)) st.hidden = data.hidden.slice(0, st.bottles.length);
    if (typeof data.moves === 'number') st.moves = data.moves;
    if (typeof data.score === 'number') st.score = data.score;
    if (typeof data.addedBottles === 'number') st.addedBottles = data.addedBottles;
    if (Array.isArray(data.history)) {
      st.history = data.history.map((h: any) => ({
        bottles: (h.bottles || []).map((b: number[]) => [...b]),
        hidden: Array.isArray(h.hidden) ? [...h.hidden] : (h.bottles || []).map(() => 0),
        score: typeof h.score === 'number' ? h.score : 0
      }));
    }
    return st;
  }
}
