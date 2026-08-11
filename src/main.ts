import './style.css';
import { GameState } from './game/GameState';
import { BoardGenerator } from './game/BoardGenerator';
import { GameEngine } from './game/GameEngine';
import { AudioSystem } from './game/AudioSystem';
import { AccessibilityManager, OverlayMode } from './game/AccessibilityManager';

const app = document.getElementById('app')!;
const accessibility = new AccessibilityManager();

function generateLevelOptionsHTML(selectedLevel: number = 1): string {
  let html = '';
  for (let i = 1; i <= 20; i++) {
    const isSelected = i === selectedLevel ? 'selected' : '';
    let label = `Level ${i}`;
    if (i === 1) label += ' (Easy)';
    else if (i === 3) label += ' (Var Capacity)';
    else if (i === 5) label += ' (Harder)';
    else if (i === 8) label += ' (Expert)';
    else if (i === 10) label += ' (Master)';
    else if (i === 20) label += ' (Max)';
    html += `<option value="${i}" ${isSelected}>${label}</option>`;
  }
  return html;
}

app.innerHTML = `
  <div class="header">
    <div class="level-display" style="display: flex; align-items: center; gap: 0.5rem;">
      <label for="header-level-select" style="font-weight: bold; font-size: 0.95rem;">Level:</label>
      <select id="header-level-select" style="padding: 0.3rem 0.6rem; font-size: 0.95rem; border-radius: 4px; background: #2a2a4e; color: #fff; border: 1px solid rgba(255,255,255,0.3); cursor: pointer;">
        ${generateLevelOptionsHTML(1)}
      </select>
    </div>
    <div class="stats" style="display: flex; align-items: center;">Moves: <span id="moves" style="margin-left: 0.3rem; font-weight: bold;">0</span></div>
    <div class="button-group">
      <button id="btn-undo">Undo</button>
      <button id="btn-reset">Reset</button>
      <button id="btn-add">+ Bottle</button>
      <button id="btn-menu" style="background: rgba(106, 13, 173, 0.6); border-color: rgba(138, 43, 226, 0.8);">Menu</button>
    </div>
  </div>
  <div class="game-container">
    <canvas id="game-canvas"></canvas>
  </div>
  <div id="start-menu" class="menu-overlay">
    <h1>Magic Sort</h1>
    <div class="menu-settings-box" style="background: rgba(255, 255, 255, 0.05); padding: 1.2rem 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 1rem; width: 90%; max-width: 360px; border: 1px solid rgba(255, 255, 255, 0.1);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <label for="select-level" style="font-weight: bold; font-size: 1rem;">Level Select:</label>
        <select id="select-level" style="padding: 0.4rem 0.8rem; font-size: 0.95rem; border-radius: 4px; background: #2a2a4e; color: #fff; border: 1px solid #555;">
          ${generateLevelOptionsHTML(1)}
        </select>
      </div>

      <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 0.8rem;">
        <div style="font-size: 0.9rem; color: #a0a0d0; font-weight: bold; margin-bottom: 0.6rem; text-align: left;">👁️ 選べる見え方サポート</div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
          <label for="select-overlay-mode" style="font-size: 0.9rem;">識別マーク表示:</label>
          <select id="select-overlay-mode" style="padding: 0.35rem 0.6rem; font-size: 0.85rem; border-radius: 4px; background: #2a2a4e; color: #fff; border: 1px solid #555;">
            <option value="none">なし (Standard)</option>
            <option value="number">数字 (1, 2, 3)</option>
            <option value="symbol">記号 (★, ■, ▲)</option>
            <option value="texture">模様 (斜線/ドット/波線)</option>
          </select>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
          <label for="toggle-colorblind-palette" style="font-size: 0.9rem;">高コントラストカラー (UD):</label>
          <input type="checkbox" id="toggle-colorblind-palette" style="width: 18px; height: 18px; cursor: pointer;">
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <label for="toggle-same-color-hl" style="font-size: 0.9rem;">選択時に同色ハイライト:</label>
          <input type="checkbox" id="toggle-same-color-hl" style="width: 18px; height: 18px; cursor: pointer;">
        </div>
      </div>
    </div>

    <button id="btn-start">Start Game</button>
  </div>
  <div id="result-menu" class="menu-overlay hidden">
    <h1>Level Cleared!</h1>
    <button id="btn-next-level">Next Level</button>
    <button id="btn-retry">Retry</button>
    <button id="btn-menu-from-result" style="background: #4a4a70; margin-top: 0.5rem;">Home Menu</button>
  </div>
`;

let state: GameState;
let engine: GameEngine;
let audio = new AudioSystem();
let currentLevel = 1;

function syncAccessibilityUI() {
  const overlaySelect = document.getElementById('select-overlay-mode') as HTMLSelectElement;
  if (overlaySelect) overlaySelect.value = accessibility.overlayMode;

  const cbToggle = document.getElementById('toggle-colorblind-palette') as HTMLInputElement;
  if (cbToggle) cbToggle.checked = accessibility.useColorblindPalette;

  const hlToggle = document.getElementById('toggle-same-color-hl') as HTMLInputElement;
  if (hlToggle) hlToggle.checked = accessibility.highlightSameColor;
}

function initGame(level: number = 1) {
  currentLevel = level;
  const { bottles, capacities } = BoardGenerator.generate(level);
  state = new GameState(bottles, capacities, level);
  
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if(engine) {
     engine.state = state;
     engine.selectedBottle = null;
  } else {
     engine = new GameEngine(canvas, state, audio, accessibility);
  }
  
  // Sync selects
  const headerSelect = document.getElementById('header-level-select') as HTMLSelectElement;
  if (headerSelect) headerSelect.value = level.toString();
  const menuSelect = document.getElementById('select-level') as HTMLSelectElement;
  if (menuSelect) menuSelect.value = level.toString();

  syncAccessibilityUI();
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
  setTimeout(() => engine?.resize(), 50);
}

function showStartMenu() {
  syncAccessibilityUI();
  document.getElementById('start-menu')?.classList.remove('hidden');
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

  const headerSelect = document.getElementById('header-level-select') as HTMLSelectElement;
  if (headerSelect) {
    headerSelect.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const level = parseInt(target.value, 10);
      startGame(level);
    });
  }

  // Accessibility event handlers
  document.getElementById('select-overlay-mode')?.addEventListener('change', (e) => {
    accessibility.overlayMode = (e.target as HTMLSelectElement).value as OverlayMode;
    accessibility.saveToStorage();
  });

  document.getElementById('toggle-colorblind-palette')?.addEventListener('change', (e) => {
    accessibility.useColorblindPalette = (e.target as HTMLInputElement).checked;
    accessibility.saveToStorage();
  });

  document.getElementById('toggle-same-color-hl')?.addEventListener('change', (e) => {
    accessibility.highlightSameColor = (e.target as HTMLInputElement).checked;
    accessibility.saveToStorage();
  });

  document.getElementById('btn-menu')?.addEventListener('click', () => showStartMenu());
  document.getElementById('btn-menu-from-result')?.addEventListener('click', () => showStartMenu());
  document.getElementById('btn-next-level')?.addEventListener('click', () => startGame(currentLevel + 1));
  document.getElementById('btn-retry')?.addEventListener('click', () => startGame(currentLevel));
  document.getElementById('btn-undo')?.addEventListener('click', () => { if(state) { state.undo(); updateUI(); } });
  document.getElementById('btn-reset')?.addEventListener('click', () => startGame(currentLevel));
  document.getElementById('btn-add')?.addEventListener('click', () => { if(state) { state.addEmptyBottle(); } });

  window.addEventListener('game-clear', () => {
    document.getElementById('result-menu')?.classList.remove('hidden');
  });

  showStartMenu();
  initGame(1);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
