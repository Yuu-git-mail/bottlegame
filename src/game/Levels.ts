// 21 面以降の面の設計。1〜20 面は従来の生成 (BoardGenerator.generate) をそのまま使う。
//
// 10 面ごとに 1 つずつ新しい仕掛けが入り、後半で混ざる。
//   21-25 色が多い (9→12 色、空き瓶 2)
//   26-30 かくし色 (上の 1 層だけ見える。注いで減ると下が見える)
//   31-35 鍵付き瓶 (ある色を 1 本そろえると使えるようになる予備の瓶)
//   36-40 手数制限 (最短手数 + 少しの余裕)
//   41-45 背の高い瓶 (容量 5〜6 が混ざる) + かくし色 (下 2 層)
//   46-50 空き瓶 1 本だけ
//   51-60 混合 (かくし色 + 鍵 + 手数制限)
//   61-   エンドレス (上の仕掛けを順に回しながら色を最大に)

export interface LevelSpec {
  level: number;
  colors: number;
  empties: number;          // 自由に使える空き瓶
  lockedEmpties: number;    // 鍵付きの空き瓶 (ある色をそろえると開く)
  capacity: number;         // 基本容量
  tallMix: boolean;         // 容量 5〜6 を混ぜる
  hiddenDepth: number;      // 0 = なし, 99 = 上 1 層以外全部, n = 下から n 層
  moveLimitSlack: number | null; // null = 制限なし, n = par + n
  minMoves: number;         // これより短く解ける盤面は作り直す
  theme: string;            // 面選択に出す短い説明
}

export const CLASSIC_MAX = 20;
export const DESIGNED_MAX = 60; // ここまでは表に焼いた盤面。以降は同じ規則で生成

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

export function specFor(level: number): LevelSpec {
  const base: LevelSpec = {
    level, colors: 8, empties: 2, lockedEmpties: 0, capacity: 4, tallMix: false,
    hiddenDepth: 0, moveLimitSlack: null, minMoves: 18, theme: ''
  };
  if (level <= 25) {
    const k = level - 21; // 0..4
    return { ...base, colors: 9 + Math.min(3, k), minMoves: 22 + k * 2, theme: '色が多い' };
  }
  if (level <= 30) {
    const k = level - 26;
    return { ...base, colors: 8 + Math.min(3, k), hiddenDepth: 99, minMoves: 20 + k * 2, theme: 'かくし色' };
  }
  if (level <= 35) {
    const k = level - 31;
    return { ...base, colors: 9 + Math.min(3, k), empties: 1, lockedEmpties: 1, minMoves: 22 + k * 2, theme: '鍵付きの瓶' };
  }
  if (level <= 40) {
    const k = level - 36;
    return { ...base, colors: 8 + Math.min(3, k), moveLimitSlack: 4 - Math.min(2, Math.floor(k / 2)), minMoves: 20 + k * 2, theme: '手数制限' };
  }
  if (level <= 45) {
    const k = level - 41;
    return { ...base, colors: 8 + Math.min(2, k), capacity: 4, tallMix: true, hiddenDepth: 2, minMoves: 22 + k * 2, theme: '背の高い瓶' };
  }
  if (level <= 50) {
    const k = level - 46;
    // 空き瓶 1 本は解ける盤面が限られるので、色は 8 まで・必要手数も控えめ
    return { ...base, colors: 6 + Math.min(2, k), empties: 1, minMoves: 16 + Math.min(3, k) * 2, theme: '空き瓶 1 本' };
  }
  if (level <= 60) {
    const k = level - 51; // 0..9
    const spec: LevelSpec = { ...base, colors: 10 + Math.min(2, Math.floor(k / 3)), minMoves: 26 + k, theme: '混合' };
    if (k % 3 === 0) { spec.hiddenDepth = 99; spec.theme = '混合: かくし色'; }
    if (k % 3 === 1) { spec.empties = 1; spec.lockedEmpties = 1; spec.theme = '混合: 鍵付き'; }
    if (k % 3 === 2) { spec.moveLimitSlack = 3; spec.theme = '混合: 手数制限'; }
    if (k >= 6) { spec.tallMix = true; spec.theme += ' + 高い瓶'; }
    return spec;
  }
  // 61 以降: エンドレス
  const k = level - 61;
  const kind = k % 6;
  const spec: LevelSpec = { ...base, colors: clamp(10 + Math.floor(k / 6), 10, 12), minMoves: 26 + Math.min(14, Math.floor(k / 2)), theme: 'エンドレス' };
  if (kind === 1) { spec.hiddenDepth = 99; spec.theme += ': かくし色'; }
  if (kind === 2) { spec.empties = 1; spec.lockedEmpties = 1; spec.theme += ': 鍵付き'; }
  if (kind === 3) { spec.moveLimitSlack = 3; spec.theme += ': 手数制限'; }
  if (kind === 4) { spec.tallMix = true; spec.hiddenDepth = 2; spec.theme += ': 高い瓶'; }
  if (kind === 5) { spec.empties = 1; spec.colors = clamp(spec.colors - 2, 7, 10); spec.theme += ': 空き瓶 1 本'; }
  return spec;
}

export function levelGroupLabel(level: number): string {
  if (level <= CLASSIC_MAX) return 'クラシック';
  if (level <= 25) return '色が多い';
  if (level <= 30) return 'かくし色';
  if (level <= 35) return '鍵付きの瓶';
  if (level <= 40) return '手数制限';
  if (level <= 45) return '背の高い瓶';
  if (level <= 50) return '空き瓶 1 本';
  if (level <= 60) return '混合';
  return 'エンドレス';
}
