# 確認: python3 games/docs/chk.py <games の絶対パス> <ゲーム名> ["読み込み後の JS"] [待つ秒]
# 3 サイズで開き、ページのはみ出し・コンソールのエラー・JS の戻り値を出し、スクショを $SHOTS（既定 /tmp/game-shots）に置く
import sys, time, json
from selenium import webdriver
root, game = sys.argv[1], sys.argv[2]
js = sys.argv[3] if len(sys.argv) > 3 else ''
wait = float(sys.argv[4]) if len(sys.argv) > 4 else 0.5
import os
out = os.environ.get('SHOTS', '/tmp/game-shots'); os.makedirs(out, exist_ok=True)
for (w, h, dpr) in [(390, 664, 3), (768, 884, 2), (1024, 628, 2)]:
    o = webdriver.ChromeOptions()
    for a in ['--headless=new', '--allow-file-access-from-files', '--no-sandbox', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required']: o.add_argument(a)
    o.add_experimental_option('mobileEmulation', {'deviceMetrics': {'width': w, 'height': h, 'pixelRatio': dpr, 'touch': True}})
    o.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
    d = webdriver.Chrome(options=o)
    d.get('file://%s/%s/index.html' % (root, game)); time.sleep(1.0)
    res = None
    if js:
        try: res = d.execute_script(js)
        except Exception as e: res = 'JSERR ' + str(e).split('\n')[0][:200]
        time.sleep(wait)
    info = d.execute_script("""
      var de=document.documentElement, b=document.body;
      var over=[]; document.querySelectorAll('.app-bar,.app-hud,.app-main,.app-controls,.stage').forEach(function(e){var r=e.getBoundingClientRect(); if(r.bottom>innerHeight+1||r.right>innerWidth+1||r.top<-1) over.push(e.className+':'+Math.round(r.bottom)+'/'+Math.round(r.right));});
      return {sh: de.scrollHeight, ih: innerHeight, sw: de.scrollWidth, iw: innerWidth, over: over};""")
    errs = [l['message'][:160] for l in d.get_log('browser') if l['level'] == 'SEVERE']
    d.save_screenshot('%s/%s_%d.png' % (out, game, w))
    print(w, 'scroll' if info['sh'] > info['ih'] + 1 or info['sw'] > info['iw'] + 1 else 'fit', info['over'], 'errs', errs, 'res', (json.dumps(res, ensure_ascii=False)[:300] if res is not None else ''))
    d.quit()
