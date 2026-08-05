export class BoardGenerator {
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
}
