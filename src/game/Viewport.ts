// 可視領域の高さを追いかけて CSS 変数 --app-h に入れる。
// iPad / iPhone の Safari は 100vh がツールバーの裏まで含むので、innerHeight と visualViewport を使う。
type Listener = () => void;

export class Viewport {
  private static listeners: Listener[] = [];
  private static timer: number | null = null;
  static height = 0;
  static width = 0;

  static init() {
    Viewport.measure();
    window.addEventListener('resize', Viewport.schedule);
    window.addEventListener('orientationchange', () => {
      setTimeout(Viewport.measure, 250);
      setTimeout(Viewport.measure, 700);
    });
    const vv = (window as any).visualViewport;
    if (vv && vv.addEventListener) {
      vv.addEventListener('resize', Viewport.schedule);
      vv.addEventListener('scroll', Viewport.schedule);
    }
    window.addEventListener('pageshow', Viewport.schedule);
    // 読み込み直後はツールバーの出入りで値が変わるので何度か測る
    setTimeout(Viewport.measure, 300);
    setTimeout(Viewport.measure, 1000);
  }

  static schedule() {
    if (Viewport.timer !== null) clearTimeout(Viewport.timer);
    Viewport.timer = window.setTimeout(Viewport.measure, 60);
  }

  static measure() {
    let h = window.innerHeight;
    const vv = (window as any).visualViewport;
    if (vv && vv.height) {
      const vh = Math.round(vv.height);
      if (vh > 200 && vh < h) h = vh;
    }
    Viewport.height = h;
    Viewport.width = window.innerWidth;
    document.documentElement.style.setProperty('--app-h', h + 'px');
    for (const fn of Viewport.listeners) {
      try { fn(); } catch (e) { console.error(e); }
    }
  }

  static onChange(fn: Listener) {
    Viewport.listeners.push(fn);
  }
}
