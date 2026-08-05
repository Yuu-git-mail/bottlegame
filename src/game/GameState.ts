export class GameState {
  bottles: number[][];
  capacity: number;
  history: { bottles: number[][]; score: number }[];
  score: number;
  moves: number;

  constructor(bottles: number[][], capacity: number = 4) {
    this.bottles = bottles.map(b => [...b]);
    this.capacity = capacity;
    this.history = [];
    this.score = 0;
    this.moves = 0;
  }

  canPour(from: number, to: number): boolean {
    if (from === to) return false;
    const bFrom = this.bottles[from];
    const bTo = this.bottles[to];
    if (bFrom.length === 0) return false;
    if (bTo.length >= this.capacity) return false;
    
    if (bTo.length === 0) return true;
    
    return bFrom[bFrom.length - 1] === bTo[bTo.length - 1];
  }

  pour(from: number, to: number): boolean {
    if (!this.canPour(from, to)) return false;
    
    this.saveState();
    
    const bFrom = this.bottles[from];
    const bTo = this.bottles[to];
    const color = bFrom[bFrom.length - 1];
    
    while (bFrom.length > 0 && bFrom[bFrom.length - 1] === color && bTo.length < this.capacity) {
      bTo.push(bFrom.pop() as number);
    }
    this.moves++;
    return true;
  }

  addEmptyBottle() {
    this.saveState();
    this.bottles.push([]);
  }

  saveState() {
    this.history.push({
      bottles: this.bottles.map(b => [...b]),
      score: this.score
    });
  }

  undo() {
    if (this.history.length > 0) {
      const last = this.history.pop()!;
      this.bottles = last.bottles.map(b => [...b]);
      this.score = last.score;
    }
  }

  isWin(): boolean {
    for (const b of this.bottles) {
      if (b.length > 0) {
        if (b.length !== this.capacity) return false;
        const color = b[0];
        if (!b.every(c => c === color)) return false;
      }
    }
    return true;
  }

  isBottleComplete(index: number): boolean {
    const b = this.bottles[index];
    if (b.length !== this.capacity) return false;
    return b.every(c => c === b[0]);
  }
}
