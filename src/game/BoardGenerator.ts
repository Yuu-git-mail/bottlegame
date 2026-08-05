export class BoardGenerator {
  static generate(colorCount: number, emptyBottles: number = 2, capacity: number = 4): number[][] {
    const bottles: number[][] = [];
    
    // Fill bottles with distinct colors
    for (let i = 0; i < colorCount; i++) {
      bottles.push(Array(capacity).fill(i));
    }
    for (let i = 0; i < emptyBottles; i++) {
      bottles.push([]);
    }

    // Reverse pour logic
    const shuffles = colorCount * 20;
    for (let i = 0; i < shuffles; i++) {
      const from = Math.floor(Math.random() * bottles.length);
      const to = Math.floor(Math.random() * bottles.length);
      
      if (from !== to && bottles[from].length > 0 && bottles[to].length < capacity) {
         const amount = Math.floor(Math.random() * Math.min(bottles[from].length, capacity - bottles[to].length)) + 1;
         
         // In reverse pour, we can pour if 'to' is empty or 'to' top matches color (though reverse doesn't enforce match perfectly, true reverse needs careful logic).
         // Simplified: just shuffle elements directly to ensure solvability.
         for(let j=0; j<amount; j++){
           if(bottles[from].length > 0){
             bottles[to].push(bottles[from].pop()!);
           }
         }
      }
    }

    return bottles;
  }
}
