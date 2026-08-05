import { GameState } from './game/GameState';
import { BoardGenerator } from './game/BoardGenerator';
import { GameEngine } from './game/GameEngine';
import { AudioSystem } from './game/AudioSystem';

const app = document.getElementById('app')!;
app.innerHTML = `
  <div class="header">
    <div class="level-display">Level <span id="level-num">1</span></div>
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
    <button id="btn-start">Start Game</button>
  </div>
  <div id="result-menu" class="menu-overlay hidden">
    <h1>Level Cleared!</h1>
    <button id="btn-next-level">Next Level</button>
    <button id="btn-retry">Retry</button>
  </div>
`;

let state: GameState;
let engine: GameEngine;
let audio = new AudioSystem();
let currentLevel = 1;

function startGame(level: number) {
  currentLevel = level;
  document.getElementById('start-menu')!.classList.add('hidden');
  document.getElementById('result-menu')!.classList.add('hidden');
  
  const { bottles, capacities } = BoardGenerator.generate(level);
  state = new GameState(bottles, capacities, level);
  
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if(engine) {
     engine.state = state;
     engine.selectedBottle = null; // reset selection
  } else {
     engine = new GameEngine(canvas, state, audio);
  }
  
  document.getElementById('level-num')!.innerText = level.toString();
  updateUI();
}

document.getElementById('btn-start')!.addEventListener('click', () => startGame(currentLevel));

document.getElementById('btn-next-level')!.addEventListener('click', () => {
  startGame(currentLevel + 1);
});

document.getElementById('btn-retry')!.addEventListener('click', () => {
  startGame(currentLevel);
});

document.getElementById('btn-undo')!.addEventListener('click', () => {
  if(state) { state.undo(); updateUI(); }
});

document.getElementById('btn-reset')!.addEventListener('click', () => {
  startGame(currentLevel);
});

document.getElementById('btn-add')!.addEventListener('click', () => {
  if(state) { state.addEmptyBottle(); }
});

window.addEventListener('game-clear', () => {
  document.getElementById('result-menu')!.classList.remove('hidden');
});

function updateUI() {
  if(!state) return;
  document.getElementById('moves')!.innerText = state.moves.toString();
}

// Auto start game on load
window.addEventListener('DOMContentLoaded', () => {
  startGame(1);
});
// Fallback if DOMContentLoaded fired already
setTimeout(() => {
  if(!state) startGame(1);
}, 100);

updateUI();
