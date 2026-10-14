import './style.css';
import { GameState } from './game/GameState';
import { BoardGenerator } from './game/BoardGenerator';
import { GameEngine } from './game/GameEngine';
import { AudioSystem } from './game/AudioSystem';
import { AccessibilityManager, OverlayMode } from './game/AccessibilityManager';
import { Viewport } from './game/Viewport';
import { solve } from './game/Solver';
import { specFor, levelGroupLabel, CLASSIC_MAX } from './game/Levels';

const app = document.getElementById('app')!;
const accessibility = new AccessibilityManager();

// 保存キー。SAVE_KEY は v1 と同じ (以前の保存を引き継ぐため変えない)
const SAVE_KEY = 'magic_sort_saved_game_state';
const CLEARED_KEY = 'magic_sort_cleared';
const LEVEL_SELECT_MAX = 99;

type ClearedMap = Record<string, { moves: number; stars: number }>;

function loadCleared(): ClearedMap {
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    if (raw) return JSON.parse(raw) || {};
  } catch { /* ignore */ }
  return {};
}
function saveCleared(m: ClearedMap) {
  try { localStorage.setItem(CLEARED_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}
let cleared: ClearedMap = loadCleared();

function highestCleared(): number {
  let max = 0;
  for (const k of Object.keys(cleared)) max = Math.max(max, parseInt(k, 10) || 0);
  return max;
}

function levelThemeText(level: number): string {
  if (level <= CLASSIC_MAX) {
    if (level === 1) return 'クラシック: まずはここから';
    return 'クラシック: 色 ' + Math.min(4 + Math.floor((level - 1) / 2), 12) + ' 種類';
  }
  const sp = specFor(level);
  const parts = [sp.theme, '色 ' + sp.colors + ' 種類'];
  if (sp.hiddenDepth > 0) parts.push('注ぐと下の色が見える');
  if (sp.lockedEmpties > 0) parts.push('🔒 の瓶は印の色をそろえると開く');
  if (sp.moveLimitSlack !== null) parts.push('手数に制限あり');
  if (sp.empties === 1 && sp.lockedEmpties === 0) parts.push('空き瓶は 1 本だけ');
  return parts.join(' / ');
}

function levelOptionsHTML(selected: number): string {
  let html = '';
  let group = '';
  for (let i = 1; i <= LEVEL_SELECT_MAX; i++) {
    const g = levelGroupLabel(i);
    if (g !== group) {
      if (group) html += '</optgroup>';
      html += `<optgroup label="${g}">`;
      group = g;
    }
    const c = cleared[String(i)];
    const mark = c ? (c.stars >= 3 ? ' ★★★' : c.stars === 2 ? ' ★★' : ' ✓') : '';
    html += `<option value="${i}" ${i === selected ? 'selected' : ''}>面 ${i}${mark}</option>`;
  }
  html += '</optgroup>';
  return html;
}

app.innerHTML = `
  <div class="header">
    <div class="level-display">
      <label for="header-level-select">面</label>
      <select id="header-level-select" aria-label="面を選ぶ"></select>
    </div>
    <div class="stats">手数 <b id="moves">0</b><span id="limit"></span></div>
    <div class="button-group">
      <button id="btn-undo" title="1 手戻す">↶ 戻す</button>
      <button id="btn-reset" title="この面を最初から">やり直し</button>
      <button id="btn-hint" title="次の 1 手を見る">ヒント</button>
      <button id="btn-add" title="空の瓶を 1 本足す">+瓶</button>
      <button id="btn-menu" class="primary">メニュー</button>
    </div>
  </div>
  <div class="game-container">
    <canvas id="game-canvas"></canvas>
    <div class="theme-label" id="theme-label"></div>
    <div class="toast" id="toast"></div>
    <div id="start-menu" class="menu-overlay">
      <h1>ボトルソート</h1>
      <div class="menu-box">
        <div class="row">
          <label for="select-level">面を選ぶ</label>
          <select id="select-level"></select>
        </div>
        <div class="row"><span class="note" id="menu-theme"></span></div>
        <div class="row"><span class="note" id="menu-progress"></span></div>
        <div class="divider"></div>
        <div class="section-title">👁️ 選べる見え方サポート</div>
        <div class="row">
          <label for="select-overlay-mode">識別マーク</label>
          <select id="select-overlay-mode">
            <option value="none">なし</option>
            <option value="number">数字 (1, 2, 3)</option>
            <option value="symbol">記号 (★, ■, ▲)</option>
            <option value="texture">模様</option>
          </select>
        </div>
        <div class="row">
          <label for="toggle-colorblind-palette">見分けやすい配色</label>
          <input type="checkbox" id="toggle-colorblind-palette">
        </div>
        <div class="row">
          <label for="toggle-same-color-hl">選んだ色を光らせる</label>
          <input type="checkbox" id="toggle-same-color-hl">
        </div>
      </div>
      <button id="btn-continue" class="btn wide hidden">続きから (面 <span id="continue-level"></span>)</button>
      <button id="btn-start" class="btn wide">この面で始める</button>
      <a class="link" href="./games/index.html">🎮 他のゲームで遊ぶ</a>
    </div>
    <div id="result-menu" class="menu-overlay hidden">
      <h1 id="result-title">クリア!</h1>
      <div class="stars" id="result-stars"></div>
      <p id="result-text"></p>
      <button id="btn-next-level" class="btn wide">次の面へ</button>
      <button id="btn-retry" class="btn wide secondary">同じ面をもう一度</button>
      <button id="btn-menu-from-result" class="btn wide secondary">メニュー</button>
    </div>
    <div id="fail-menu" class="menu-overlay hidden">
      <h1>手数切れ</h1>
      <p id="fail-text"></p>
      <button id="btn-fail-undo" class="btn wide">1 手戻す</button>
      <button id="btn-fail-retry" class="btn wide secondary">最初からやり直す</button>
      <button id="btn-fail-menu" class="btn wide secondary">メニュー</button>
    </div>
  </div>
`;

let state: GameState;
let engine: GameEngine;
const audio = new AudioSystem();
let currentLevel = 1;
let toastTimer: number | null = null;

function toast(msg: string, ms = 1600) {
  const el = document.getElementById('toast')!;
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), ms);
}

function $(id: string) { return document.getElementById(id); }

function refreshLevelSelects(level: number) {
  const hs = $('header-level-select') as HTMLSelectElement;
  const ms = $('select-level') as HTMLSelectElement;
  if (hs) hs.innerHTML = levelOptionsHTML(level);
  if (ms) ms.innerHTML = levelOptionsHTML(level);
  updateMenuTheme(level);
}

function updateMenuTheme(level: number) {
  const t = $('menu-theme');
  if (t) t.textContent = levelThemeText(level);
  const p = $('menu-progress');
  if (p) {
    const hc = highestCleared();
    const count = Object.keys(cleared).length;
    p.textContent = count > 0 ? `クリア済み ${count} 面 (最高 面 ${hc})` : 'クリアした面には ✓ が付きます';
  }
}

function syncAccessibilityUI() {
  const o = $('select-overlay-mode') as HTMLSelectElement;
  if (o) o.value = accessibility.overlayMode;
  const cb = $('toggle-colorblind-palette') as HTMLInputElement;
  if (cb) cb.checked = accessibility.useColorblindPalette;
  const hl = $('toggle-same-color-hl') as HTMLInputElement;
  if (hl) hl.checked = accessibility.highlightSameColor;
}

function saveGameStateToStorage() {
  if (!state) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state.toJSON()));
  } catch (err) {
    console.warn('auto-save failed', err);
  }
}

function loadSavedGameState(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    const st = GameState.fromJSON(data);
    if (!st) return false;
    if (st.isWin()) return false;
    state = st;
    currentLevel = st.level;
    attachEngine();
    return true;
  } catch (err) {
    console.warn('restore failed', err);
    return false;
  }
}

function clearSavedGameState() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

function attachEngine() {
  const canvas = $('game-canvas') as HTMLCanvasElement;
  if (engine) {
    engine.setState(state);
  } else {
    engine = new GameEngine(canvas, state, audio, accessibility);
    engine.onInvalidTap = (reason) => {
      if (reason === 'locked') {
        toast('🔒 印の色を 1 本そろえると使えます');
      }
    };
  }
  refreshLevelSelects(currentLevel);
  syncAccessibilityUI();
  updateUI();
}

function initGame(level: number) {
  currentLevel = level;
  const b = BoardGenerator.board(level);
  state = new GameState(b.bottles, b.capacities, level, {
    hidden: b.hidden,
    locks: b.locks,
    moveLimit: b.moveLimit === undefined ? null : b.moveLimit,
    par: b.par === undefined ? null : b.par
  });
  attachEngine();
  saveGameStateToStorage();
}

function updateUI() {
  if (!state) return;
  const movesEl = $('moves');
  if (movesEl) movesEl.textContent = String(state.moves);
  const limitEl = $('limit');
  if (limitEl) {
    if (state.moveLimit !== null) {
      const left = state.movesLeft!;
      limitEl.innerHTML = ` <span class="limit${left <= 3 ? ' danger' : ''}">/ ${state.moveLimit} (残り ${Math.max(0, left)})</span>`;
    } else {
      limitEl.innerHTML = '';
    }
  }
  const theme = $('theme-label');
  if (theme) theme.textContent = `面 ${currentLevel} — ${levelThemeText(currentLevel)}`;
  const hintBtn = $('btn-hint') as HTMLButtonElement;
  if (hintBtn) hintBtn.disabled = state.hasHidden;
  const undoBtn = $('btn-undo') as HTMLButtonElement;
  if (undoBtn) undoBtn.disabled = state.history.length === 0;
}

function hideOverlays() {
  $('start-menu')?.classList.add('hidden');
  $('result-menu')?.classList.add('hidden');
  $('fail-menu')?.classList.add('hidden');
}

function startGame(level: number) {
  initGame(level);
  hideOverlays();
  setTimeout(() => engine?.resize(), 50);
}

function continueGame() {
  hideOverlays();
  setTimeout(() => engine?.resize(), 50);
}

function showStartMenu() {
  syncAccessibilityUI();
  refreshLevelSelects(currentLevel);
  const cont = $('btn-continue');
  const canContinue = !!state && !state.isWin() && state.moves > 0;
  if (cont) {
    cont.classList.toggle('hidden', !canContinue);
    const cl = $('continue-level');
    if (cl) cl.textContent = String(currentLevel);
  }
  $('start-menu')?.classList.remove('hidden');
  $('result-menu')?.classList.add('hidden');
  $('fail-menu')?.classList.add('hidden');
}

function starsFor(moves: number, par: number | null): number {
  if (par === null) return 0;
  if (moves <= par) return 3;
  if (moves <= par + 4) return 2;
  return 1;
}

function showResult() {
  const stars = starsFor(state.moves, state.par);
  const key = String(currentLevel);
  const prev = cleared[key];
  if (!prev || state.moves < prev.moves || stars > prev.stars) {
    cleared[key] = { moves: state.moves, stars: Math.max(stars, prev ? prev.stars : 0) };
    saveCleared(cleared);
  }
  const title = $('result-title');
  if (title) title.textContent = `面 ${currentLevel} クリア!`;
  const starsEl = $('result-stars');
  if (starsEl) {
    if (stars > 0) {
      starsEl.innerHTML = [1, 2, 3].map(i => `<span class="${i <= stars ? '' : 'off'}">★</span>`).join('');
    } else {
      starsEl.innerHTML = '🎉';
    }
  }
  const text = $('result-text');
  if (text) {
    let t = `手数 ${state.moves}`;
    if (state.par !== null) t += ` / 最短 ${state.par}`;
    if (prev && prev.moves < state.moves) t += ` (自己ベスト ${prev.moves})`;
    if (state.addedBottles > 0) t += ` / 瓶を ${state.addedBottles} 本追加`;
    text.textContent = t;
  }
  $('result-menu')?.classList.remove('hidden');
}

function showFail() {
  const t = $('fail-text');
  if (t) t.textContent = `この面は ${state.moveLimit} 手以内で解きます。最短は ${state.par ?? '?'} 手です。`;
  $('fail-menu')?.classList.remove('hidden');
}

function doHint() {
  if (!state || state.isWin()) return;
  if (state.hasHidden) { toast('かくし色の面ではヒントは使えません'); return; }
  const t0 = performance.now();
  const r = solve({ bottles: state.bottles, capacities: state.capacities, locks: state.locks }, 25000);
  const dt = Math.round(performance.now() - t0);
  if (r.solvable && r.path.length > 0) {
    engine.showHint(r.path[0]);
    toast(`▲ の瓶から ▼ の瓶へ (あと ${r.moves} 手)`, 2500);
  } else if (r.exhausted) {
    toast('この局面は複雑すぎて読み切れませんでした');
  } else {
    toast('ここからは解けません。戻すか、+瓶 を使ってください', 2600);
  }
  if (dt > 500) console.log('hint took', dt, 'ms');
}

function initApp() {
  Viewport.init();
  Viewport.onChange(() => engine?.resize());

  $('btn-start')?.addEventListener('click', () => {
    const sel = $('select-level') as HTMLSelectElement;
    const level = sel ? parseInt(sel.value, 10) : currentLevel;
    startGame(level);
  });
  $('btn-continue')?.addEventListener('click', () => continueGame());
  ($('select-level') as HTMLSelectElement)?.addEventListener('change', (e) => {
    updateMenuTheme(parseInt((e.target as HTMLSelectElement).value, 10));
  });
  ($('header-level-select') as HTMLSelectElement)?.addEventListener('change', (e) => {
    startGame(parseInt((e.target as HTMLSelectElement).value, 10));
  });

  $('select-overlay-mode')?.addEventListener('change', (e) => {
    accessibility.overlayMode = (e.target as HTMLSelectElement).value as OverlayMode;
    accessibility.saveToStorage();
  });
  $('toggle-colorblind-palette')?.addEventListener('change', (e) => {
    accessibility.useColorblindPalette = (e.target as HTMLInputElement).checked;
    accessibility.saveToStorage();
  });
  $('toggle-same-color-hl')?.addEventListener('change', (e) => {
    accessibility.highlightSameColor = (e.target as HTMLInputElement).checked;
    accessibility.saveToStorage();
  });

  $('btn-menu')?.addEventListener('click', () => showStartMenu());
  $('btn-menu-from-result')?.addEventListener('click', () => showStartMenu());
  $('btn-fail-menu')?.addEventListener('click', () => showStartMenu());
  $('btn-next-level')?.addEventListener('click', () => startGame(currentLevel + 1));
  const retry = () => {
    if (!state) return;
    state.restartToInitial();
    engine.setState(state);
    hideOverlays();
    updateUI();
    saveGameStateToStorage();
  };
  $('btn-retry')?.addEventListener('click', retry);
  $('btn-fail-retry')?.addEventListener('click', retry);
  $('btn-reset')?.addEventListener('click', retry);
  const undo = () => {
    if (!state) return;
    if (state.undo()) {
      engine.selectedBottle = null;
      hideOverlays();
      updateUI();
      saveGameStateToStorage();
    }
  };
  $('btn-undo')?.addEventListener('click', undo);
  $('btn-fail-undo')?.addEventListener('click', undo);
  $('btn-add')?.addEventListener('click', () => {
    if (!state) return;
    if (state.addedBottles >= 2) { toast('追加できる瓶は 2 本までです'); return; }
    state.addEmptyBottle();
    engine.selectedBottle = null;
    engine.computeLayout();
    hideOverlays();
    updateUI();
    saveGameStateToStorage();
  });
  $('btn-hint')?.addEventListener('click', doHint);

  window.addEventListener('state-changed', () => {
    updateUI();
    saveGameStateToStorage();
    if (state.isOutOfMoves()) {
      setTimeout(() => { if (state.isOutOfMoves()) showFail(); }, 350);
    } else if (state.isStuck() && !state.isWin()) {
      toast('動かせる手がありません。戻す か +瓶 を使ってください', 2600);
    }
  });

  window.addEventListener('game-clear', () => {
    clearSavedGameState();
    showResult();
  });

  const restored = loadSavedGameState();
  if (!restored) initGame(1);
  showStartMenu();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
