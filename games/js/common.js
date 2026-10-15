/* =====================================================================
   common.js - ゲーム集 共通ヘルパー window.GameHub
   目的: スマホ/iPad Safari で「全画面・スクロール無し・見切れ無し」を
         どのゲームでも同じやり方で実現する。
   古い Safari(iOS 12 程度)でも動くよう、?. / ?? / class fields は使わない。
   ===================================================================== */
(function () {
  'use strict';

  var listeners = [];
  var measureTimer = null;

  // 可視高さ(px)を --app-h に入れる。100vh はツールバー分だけ大きいので使わない。
  function measure() {
    var h = window.innerHeight;
    var vv = window.visualViewport;
    if (vv && vv.height) {
      var vh = Math.round(vv.height);
      // キーボード表示中などで極端に小さいときは無視
      if (vh > 200 && vh < h) h = vh;
    }
    var root = document.documentElement;
    root.style.setProperty('--app-h', h + 'px');
    root.style.setProperty('--app-w', window.innerWidth + 'px');
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](); } catch (e) { if (window.console) console.error(e); }
    }
    return h;
  }

  function scheduleMeasure() {
    if (measureTimer) clearTimeout(measureTimer);
    measureTimer = setTimeout(measure, 60);
  }

  function onResize(fn) {
    listeners.push(fn);
  }

  // .stage を親(.app-main)の空きに、縦横比を保って最大で収める
  function fitStage(stage, baseW, baseH, opts) {
    opts = opts || {};
    var main = stage.parentElement;
    var r = main.getBoundingClientRect();
    var cs = window.getComputedStyle(main);
    var padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    var padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    var availW = Math.max(50, r.width - padX);
    var availH = Math.max(50, r.height - padY);
    var s = Math.min(availW / baseW, availH / baseH);
    if (opts.maxScale) s = Math.min(s, opts.maxScale);
    var w = Math.floor(baseW * s);
    var h = Math.floor(baseH * s);
    stage.style.width = w + 'px';
    stage.style.height = h + 'px';
    return { scale: s, width: w, height: h, availW: availW, availH: availH };
  }

  // canvas の CSS サイズと内部解像度(DPR)を合わせる。戻り値は ctx(論理px座標)
  function setupCanvas(canvas, cssW, cssH, maxDpr) {
    var dpr = Math.min(window.devicePixelRatio || 1, maxDpr || 3);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  // 「.stage の中に canvas 1 枚」の定型。resize 時に自動で合わせ直す。
  // onLayout(cssW, cssH, ctx) は毎回呼ばれる(再描画はゲーム側で)。
  function canvasStage(canvas, baseW, baseH, onLayout) {
    var stage = canvas.parentElement;
    var ctx = null;
    function layout() {
      var f = fitStage(stage, baseW, baseH);
      ctx = setupCanvas(canvas, f.width, f.height);
      if (onLayout) onLayout(f.width, f.height, ctx, f.scale);
    }
    onResize(layout);
    // 最初の 1 回は呼び出し側の変数がまだ無いことがあるので、失敗しても止めず、次のティックでもう一度
    try { layout(); } catch (e) { /* 初回だけは黙って次のティックに任せる */ }
    setTimeout(function () { try { layout(); } catch (e) { if (window.console) console.error(e); } }, 0);
    return {
      relayout: layout,
      // 盤の論理サイズを変えて合わせ直す(面ごとに盤の大きさが違うゲーム用)
      setBase: function (w, h) { baseW = w; baseH = h; layout(); },
      ctx: function () { return ctx; },
      // クライアント座標 → 盤面基準座標(baseW x baseH)
      toBase: function (clientX, clientY) {
        var r = canvas.getBoundingClientRect();
        return {
          x: (clientX - r.left) / r.width * baseW,
          y: (clientY - r.top) / r.height * baseH
        };
      }
    };
  }

  // ---------- 上部バー ----------
  function renderBar() {
    var bar = document.querySelector('.app-bar[data-title]');
    if (!bar) return;
    var title = bar.getAttribute('data-title') || 'GAME';
    var back = bar.getAttribute('data-back') || '../index.html';
    var hasReset = bar.hasAttribute('data-reset');
    var hasHelp = !!document.getElementById('help-sheet') || bar.hasAttribute('data-help');
    var html = '<a href="' + back + '" class="bar-btn" aria-label="ゲーム一覧へ戻る">←<span class="bar-back-text"> 一覧</span></a>';
    html += '<div class="bar-title">' + title + '</div>';
    if (hasHelp) html += '<button type="button" class="bar-btn icon" id="btn-bar-help" aria-label="遊び方">?</button>';
    if (hasReset) html += '<button type="button" class="bar-btn" id="btn-bar-reset" aria-label="最初から">↻</button>';
    bar.innerHTML = html;
    var rb = document.getElementById('btn-bar-reset');
    if (rb) rb.addEventListener('click', function () {
      if (typeof window.resetGame === 'function') window.resetGame();
      else window.location.reload();
    });
    var hb = document.getElementById('btn-bar-help');
    if (hb) hb.addEventListener('click', function () { showHelp(); });
    document.title = title + ' - ゲーム集';
  }

  // ---------- ヘルプシート ----------
  // <div id="help-sheet" class="sheet hidden"><div class="sheet-body">…</div></div> を用意すると ? ボタンで開く
  function showHelp() {
    var sheet = document.getElementById('help-sheet');
    if (!sheet) {
      var bar = document.querySelector('.app-bar[data-help]');
      if (!bar) return;
      sheet = document.createElement('div');
      sheet.id = 'help-sheet';
      sheet.className = 'sheet hidden';
      sheet.innerHTML = '<div class="sheet-body"><p>' + bar.getAttribute('data-help') + '</p></div>';
      (document.querySelector('.app-main') || document.body).appendChild(sheet);
    }
    if (!sheet.querySelector('.sheet-foot')) {
      var foot = document.createElement('div');
      foot.className = 'sheet-foot';
      foot.innerHTML = '<button type="button" class="btn">閉じる</button>';
      foot.firstChild.addEventListener('click', function () { sheet.classList.add('hidden'); if (typeof window.onHelpClose === 'function') window.onHelpClose(); });
      sheet.appendChild(foot);
    }
    if (typeof window.onHelpOpen === 'function') window.onHelpOpen();
    sheet.classList.remove('hidden');
  }

  // ---------- オーバーレイ ----------
  // overlay({title, html, big, buttons:[{label, onClick, secondary}]}) → el(.close())
  function overlay(opts) {
    var main = document.querySelector('.app-main') || document.body;
    var el = document.createElement('div');
    el.className = 'overlay';
    var html = '';
    if (opts.title) html += '<h2>' + opts.title + '</h2>';
    if (opts.big !== undefined) html += '<div class="big">' + opts.big + '</div>';
    if (opts.html) html += '<p>' + opts.html + '</p>';
    html += '<div class="btn-row"></div>';
    el.innerHTML = html;
    var row = el.querySelector('.btn-row');
    (opts.buttons || []).forEach(function (b) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn' + (b.secondary ? ' secondary' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (!b.keep) el.close();
        if (b.onClick) b.onClick();
      });
      row.appendChild(btn);
    });
    if (opts.tapAnywhere) {
      onTap(el, function () { el.close(); opts.tapAnywhere(); });
    }
    el.close = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    main.appendChild(el);
    return el;
  }

  var toastEl = null, toastTimer = null;
  function toast(msg, ms) {
    var main = document.querySelector('.app-main') || document.body;
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; main.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 1400);
  }

  // ---------- 入力 ----------
  var hasPointer = !!window.PointerEvent;

  // タップ(押した瞬間)。pointer / touch / click の二重発火を防ぐ
  function onTap(el, fn) {
    var last = 0;
    function fire(e, x, y) {
      var now = Date.now();
      if (now - last < 120) return;
      last = now;
      fn(x, y, e);
    }
    if (hasPointer) {
      el.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        fire(e, e.clientX, e.clientY);
      });
    } else {
      el.addEventListener('touchstart', function (e) {
        var t = e.touches[0];
        if (t) fire(e, t.clientX, t.clientY);
      }, { passive: true });
      el.addEventListener('mousedown', function (e) { fire(e, e.clientX, e.clientY); });
    }
  }

  // スワイプ: fn('left'|'right'|'up'|'down') / onTapFn(x,y)
  function swipe(el, fn, onTapFn, threshold) {
    threshold = threshold || 24;
    var sx = 0, sy = 0, active = false, moved = false;
    function start(x, y) { sx = x; sy = y; active = true; moved = false; }
    function move(x, y) {
      if (!active) return;
      var dx = x - sx, dy = y - sy;
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
      active = false; moved = true;
      fn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    }
    function end(x, y) {
      if (active && !moved && onTapFn) onTapFn(x, y);
      active = false;
    }
    if (hasPointer) {
      el.addEventListener('pointerdown', function (e) { start(e.clientX, e.clientY); });
      el.addEventListener('pointermove', function (e) { move(e.clientX, e.clientY); });
      el.addEventListener('pointerup', function (e) { end(e.clientX, e.clientY); });
      el.addEventListener('pointercancel', function () { active = false; });
    } else {
      el.addEventListener('touchstart', function (e) { var t = e.touches[0]; if (t) start(t.clientX, t.clientY); }, { passive: true });
      el.addEventListener('touchmove', function (e) { var t = e.touches[0]; if (t) move(t.clientX, t.clientY); }, { passive: true });
      el.addEventListener('touchend', function (e) { var t = e.changedTouches[0]; if (t) end(t.clientX, t.clientY); });
      el.addEventListener('mousedown', function (e) { start(e.clientX, e.clientY); });
      el.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); });
      el.addEventListener('mouseup', function (e) { end(e.clientX, e.clientY); });
    }
  }

  // 押しっぱなし対応ボタン。onDown は押した瞬間、hold=true なら一定間隔で繰り返す
  function holdButton(btn, onDown, onUp, repeatMs) {
    var timer = null, pressed = false;
    function down(e) {
      if (e && e.cancelable && e.type !== 'pointerdown') e.preventDefault();
      if (pressed) return;
      pressed = true;
      btn.classList.add('pressed');
      onDown();
      if (repeatMs) {
        timer = setInterval(onDown, repeatMs);
      }
    }
    function up() {
      if (!pressed) return;
      pressed = false;
      btn.classList.remove('pressed');
      if (timer) { clearInterval(timer); timer = null; }
      if (onUp) onUp();
    }
    if (hasPointer) {
      btn.addEventListener('pointerdown', function (e) { btn.setPointerCapture && btn.setPointerCapture(e.pointerId); down(e); });
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
    } else {
      btn.addEventListener('touchstart', down, { passive: false });
      btn.addEventListener('touchend', up);
      btn.addEventListener('touchcancel', up);
      btn.addEventListener('mousedown', down);
      btn.addEventListener('mouseup', up);
      btn.addEventListener('mouseleave', up);
    }
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  // 十字キーを container に作る。onDir('up'|'down'|'left'|'right', pressed:boolean)
  // opts.center = {label, onPress} 中央ボタン(回転・決定など)、opts.repeatMs 押しっぱなし間隔
  function dpad(container, onDir, opts) {
    opts = opts || {};
    container.classList.add('dpad');
    var dirs = [['up', '▲'], ['left', '◀'], ['right', '▶'], ['down', '▼']];
    dirs.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ctl-btn ' + d[0];
      b.textContent = d[1];
      b.setAttribute('aria-label', d[0]);
      holdButton(b, function () { onDir(d[0], true); }, function () { onDir(d[0], false); }, opts.repeatMs);
      container.appendChild(b);
    });
    if (opts.center) {
      var c = document.createElement('button');
      c.type = 'button';
      c.className = 'ctl-btn center';
      c.textContent = opts.center.label;
      holdButton(c, opts.center.onPress, null, 0);
      container.appendChild(c);
    }
    return container;
  }

  // キーボード。map = { ArrowLeft: fn, ' ': fn, ... }。onUp は離したとき(任意)
  function keys(map, onUp) {
    document.addEventListener('keydown', function (e) {
      var k = e.key;
      if (map[k]) {
        if (!e.repeat || map.__repeat) map[k](e);
        e.preventDefault();
      }
    });
    if (onUp) document.addEventListener('keyup', function (e) { onUp(e.key, e); });
  }

  // ---------- 保存 ----------
  function store(ns) {
    var prefix = 'gamehub:' + ns + ':';
    return {
      get: function (key, def) {
        try { var v = localStorage.getItem(prefix + key); return v === null ? def : JSON.parse(v); } catch (e) { return def; }
      },
      set: function (key, val) {
        try { localStorage.setItem(prefix + key, JSON.stringify(val)); } catch (e) { /* ignore */ }
      },
      remove: function (key) { try { localStorage.removeItem(prefix + key); } catch (e) { /* ignore */ } }
    };
  }

  // ---------- 音(効果音の簡易合成。失敗しても落ちない) ----------
  var actx = null;
  function audioInit() {
    try {
      if (!actx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) actx = new AC();
      }
      if (actx && actx.state === 'suspended') actx.resume().catch(function () {});
    } catch (e) { /* ignore */ }
  }
  function beep(freq, dur, type, vol) {
    try {
      if (!actx) return;
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, actx.currentTime);
      g.gain.setValueAtTime(vol || 0.08, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + (dur || 0.1));
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + (dur || 0.1));
    } catch (e) { /* ignore */ }
  }
  var muted = false;
  try { muted = localStorage.getItem('gamehub:muted') === '1'; } catch (e) { /* ignore */ }
  var audio = {
    init: audioInit,
    beep: function (f, d, t, v) { if (!muted) beep(f, d, t, v); },
    click: function () { if (!muted) beep(600, 0.06, 'square', 0.04); },
    good: function () { if (!muted) { beep(660, 0.08); setTimeout(function () { beep(880, 0.12); }, 70); } },
    bad: function () { if (!muted) beep(140, 0.25, 'sawtooth', 0.06); },
    win: function () { if (!muted) { beep(523, 0.15); setTimeout(function () { beep(659, 0.15); }, 120); setTimeout(function () { beep(784, 0.3); }, 240); } },
    setMuted: function (m) { muted = !!m; try { localStorage.setItem('gamehub:muted', m ? '1' : '0'); } catch (e) { /* ignore */ } },
    isMuted: function () { return muted; }
  };

  // ---------- ループ ----------
  // loop(update(dtSec), draw) → {start, stop, pause(bool), running}
  function loop(update, draw) {
    var running = false, paused = false, last = 0, id = 0;
    function frame(t) {
      if (!running) return;
      var dt = (t - last) / 1000;
      last = t;
      if (dt > 0.1) dt = 0.1; // タブ復帰などで飛ばない
      if (!paused) {
        try { update(dt); draw(); } catch (e) { if (window.console) console.error(e); }
      }
      id = window.requestAnimationFrame(frame);
    }
    var api = {
      start: function () { if (running) return; running = true; last = performance.now(); id = window.requestAnimationFrame(frame); },
      stop: function () { running = false; if (id) window.cancelAnimationFrame(id); },
      pause: function (p) { paused = !!p; if (!p) last = performance.now(); },
      isPaused: function () { return paused; },
      isRunning: function () { return running; }
    };
    return api;
  }

  // ---------- 種付き乱数 ----------
  // rng(seed) → 0..1 を返す関数。同じ種なら同じ並び(面の生成用)
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- 面選択 ----------
  // levelPicker({count, current, done(i)→bool, label(i)→文字(任意), onPick(i), title})
  // 一覧は指でスクロールできる(.scrollable)
  function levelPicker(opts) {
    var n = opts.count, cleared = 0, i;
    for (i = 0; i < n; i++) if (opts.done && opts.done(i)) cleared++;
    var html = '<span class="lvp-sub">クリア ' + cleared + ' / ' + n + '　✓ はクリア済み</span><span class="lvp-grid">';
    for (i = 0; i < n; i++) {
      var d = opts.done && opts.done(i);
      var sub = opts.label ? opts.label(i) : '';
      html += '<button type="button" class="lvp-btn' + (d ? ' done' : '') + (i === opts.current ? ' now' : '') + '" data-i="' + i + '">' + (i + 1) + (sub ? '<small>' + sub + '</small>' : '') + '</button>';
    }
    html += '</span>';
    var el = overlay({ title: opts.title || '面を選ぶ', html: html,
      buttons: [{ label: '閉じる', secondary: true, onClick: function () { if (opts.onClose) opts.onClose(); } }] });
    el.className += ' lvpick scrollable';
    var btns = el.querySelectorAll('.lvp-btn');
    for (i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(e.currentTarget.getAttribute('data-i'), 10);
        el.close();
        opts.onPick(idx);
      });
    }
    var now = el.querySelector('.lvp-btn.now');
    if (now && now.scrollIntoView) { try { now.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ } }
    return el;
  }

  // 画面が隠れたら一時停止させたいゲーム用
  function pauseWhenHidden(onHide, onShow) {
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (onHide) onHide(); } else { if (onShow) onShow(); }
    });
    window.addEventListener('pagehide', function () { if (onHide) onHide(); });
    window.addEventListener('blur', function () { if (onHide) onHide(); });
  }

  // ---------- 初期化 ----------
  function init() {
    measure();
    renderBar();
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('orientationchange', function () { setTimeout(measure, 250); setTimeout(measure, 600); });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', scheduleMeasure);
      window.visualViewport.addEventListener('scroll', scheduleMeasure);
    }
    window.addEventListener('pageshow', scheduleMeasure);
    setTimeout(measure, 300);
    setTimeout(measure, 1000);

    // ゲーム画面では画面全体のスクロールやピンチを止める(.sheet-body の中は除く)
    if (document.body.classList.contains('game')) {
      document.addEventListener('touchmove', function (e) {
        var t = e.target;
        while (t && t !== document.body) {
          if (t.classList && (t.classList.contains('sheet-body') || t.classList.contains('scrollable'))) return;
          t = t.parentNode;
        }
        if (e.cancelable) e.preventDefault();
      }, { passive: false });
      document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
      document.addEventListener('dblclick', function (e) { e.preventDefault(); });
      // 最初の操作で音を許可
      var once = function () { audioInit(); document.removeEventListener('pointerdown', once); document.removeEventListener('touchstart', once); document.removeEventListener('keydown', once); };
      document.addEventListener('pointerdown', once);
      document.addEventListener('touchstart', once, { passive: true });
      document.addEventListener('keydown', once);
    }
  }

  window.GameHub = {
    measure: measure,
    onResize: onResize,
    fitStage: fitStage,
    setupCanvas: setupCanvas,
    canvasStage: canvasStage,
    overlay: overlay,
    toast: toast,
    showHelp: showHelp,
    onTap: onTap,
    swipe: swipe,
    holdButton: holdButton,
    dpad: dpad,
    keys: keys,
    store: store,
    audio: audio,
    loop: loop,
    pauseWhenHidden: pauseWhenHidden,
    rng: rng,
    levelPicker: levelPicker,
    isTouch: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0)
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
