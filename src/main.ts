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
    <div class="level-select" style="margin-bottom: 1.5rem; display: flex; gap: 0.5rem; align-items: center;">
      <label for="select-level" style="font-size: 1.1rem;">Select Level:</label>
      <select id="select-level" style="padding: 0.5rem 1rem; font-size: 1rem; border-radius: 4px; background: #2a2a4e; color: #fff; border: 1px solid #555;">
        <option value="1">Level 1 (Easy)</option>
        <option value="2">Level 2</option>
        <option value="3">Level 3 (Variable Capacity)</option>
        <option value="5">Level 5 (Harder)</option>
        <option value="8">Level 8 (Expert)</option>
      </select>
    </div>
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

function initGame(level: number = 1) {
  currentLevel = level;
  const { bottles, capacities } = BoardGenerator.generate(level);
  state = new GameState(bottles, capacities, level);
  
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if(engine) {
     engine.state = state;
     engine.selectedBottle = null;
  } else {
     engine = new GameEngine(canvas, state, audio);
  }
  
  document.getElementById('level-num')!.innerText = level.toString();
  updateUI();
}

function updateUI() {
  if(!state) return;
  const movesEl = document.getElementById('moves');
  if (movesEl) movesEl.innerText = state.moves.toString();
}

function startGame(level: number) {
  initGame(level);
  document.getElementById('start-menu')?.classList.add('hidden');
  document.getElementById('result-menu')?.classList.add('hidden');
}

function initApp() {
  const startBtn = document.getElementById('btn-start');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      const select = document.getElementById('select-level') as HTMLSelectElement;
      const level = select ? parseInt(select.value, 10) : currentLevel;
      startGame(level);
    });
  }

  document.getElementById('btn-next-level')?.addEventListener('click', () => startGame(currentLevel + 1));
  document.getElementById('btn-retry')?.addEventListener('click', () => startGame(currentLevel));
  document.getElementById('btn-undo')?.addEventListener('click', () => { if(state) { state.undo(); updateUI(); } });
  document.getElementById('btn-reset')?.addEventListener('click', () => startGame(currentLevel));
  document.getElementById('btn-add')?.addEventListener('click', () => { if(state) { state.addEmptyBottle(); } });

  window.addEventListener('game-clear', () => {
    document.getElementById('result-menu')?.classList.remove('hidden');
  });

  document.getElementById('start-menu')?.classList.remove('hidden');
  document.getElementById('result-menu')?.classList.add('hidden');

  initGame(1);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
