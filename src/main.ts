import { GameState } from './game/GameState';
import { BoardGenerator } from './game/BoardGenerator';
import { GameEngine } from './game/GameEngine';
import { AudioSystem } from './game/AudioSystem';

const app = document.getElementById('app')!;
app.innerHTML = `
  <div class="header">
    <div class="stats">Moves: <span id="moves">0</span></div>
    <div class="button-group">
      <button id="btn-undo">Undo</button>
      <button id="btn-reset">Reset</button>
      <button id="btn-add">Add Bottle</button>
    </div>
  </div>
  <div class="game-container">
    <canvas id="game-canvas"></canvas>
  </div>
  <div id="start-menu" class="menu-overlay">
    <h1>Magic Sort</h1>
    <button id="btn-easy">Easy</button>
    <button id="btn-medium">Medium</button>
    <button id="btn-hard">Hard</button>
  </div>
`;

let state: GameState;
let engine: GameEngine;
let audio = new AudioSystem();

function startGame(colorCount: number) {
  document.getElementById('start-menu')!.classList.add('hidden');
  const bottles = BoardGenerator.generate(colorCount);
  state = new GameState(bottles);
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if(engine) {
     engine.state = state;
  } else {
     engine = new GameEngine(canvas, state, audio);
  }
  updateUI();
}

document.getElementById('btn-easy')!.addEventListener('click', () => startGame(4));
document.getElementById('btn-medium')!.addEventListener('click', () => startGame(6));
document.getElementById('btn-hard')!.addEventListener('click', () => startGame(8));

document.getElementById('btn-undo')!.addEventListener('click', () => {
  if(state) { state.undo(); updateUI(); }
});

document.getElementById('btn-reset')!.addEventListener('click', () => {
  if(state) {
    document.getElementById('start-menu')!.classList.remove('hidden');
  }
});

document.getElementById('btn-add')!.addEventListener('click', () => {
  if(state) { state.addEmptyBottle(); }
});

function updateUI() {
  if(!state) return;
  document.getElementById('moves')!.innerText = state.moves.toString();
  requestAnimationFrame(updateUI);
}
updateUI();
