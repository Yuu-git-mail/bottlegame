#!/usr/bin/env python3
"""memo/index.html の CSP を書き直す。中の <script> と <style> を変えたら流す。
使い方: python3 scripts/memo_csp.py          … 書き直す
        python3 scripts/memo_csp.py --check  … ずれていたら 1 で終わる
"""
import base64, hashlib, pathlib, re, sys

P = pathlib.Path(__file__).resolve().parent.parent / 'memo' / 'index.html'

def h(body):
    return "'sha256-" + base64.b64encode(hashlib.sha256(body.encode()).digest()).decode() + "'"

s = P.read_text(encoding='utf-8')
scripts = re.findall(r'<script>(.*?)</script>', s, re.S)
styles = re.findall(r'<style>(.*?)</style>', s, re.S)
csp = '; '.join([
    "default-src 'none'",
    'script-src ' + ' '.join(h(b) for b in scripts),
    'style-src ' + ' '.join(h(b) for b in styles),
    "img-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "connect-src 'none'",
    "font-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "child-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "require-trusted-types-for 'script'",
    'trusted-types memo',
])
new = re.sub(r'(<meta http-equiv="Content-Security-Policy" content=")[^"]*(")', lambda m: m.group(1) + csp + m.group(2), s, count=1)
if '--check' in sys.argv:
    sys.exit(0 if new == s else 1)
P.write_text(new, encoding='utf-8')
print(csp)
