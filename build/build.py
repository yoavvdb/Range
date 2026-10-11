"""Builds the installable (PWA) version of Range from range-mobility.html.
Usage: python3 build.py   ->  writes ./dist/ (upload that folder to any static host)."""
import os, re, json, shutil
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "range.html")
DIST = os.environ.get("RANGE_DIST") or os.path.join(HERE, "dist")
BG, ACCENT, INK = (13, 16, 21), (63, 208, 201), (233, 238, 243)

def icon(size, maskable=False):
    s = size * 4  # draw large, downsample for smooth edges
    im = Image.new("RGB", (s, s), BG)
    d = ImageDraw.Draw(im)
    pad = int(s * (0.22 if maskable else 0.14))
    box = [pad, pad, s - pad, s - pad]
    w = int(s * 0.075)
    d.arc(box, start=150, end=390, fill=(40, 48, 58), width=w)       # full range track
    d.arc(box, start=150, end=330, fill=ACCENT, width=w)              # your range
    # end-of-range dot
    import math
    cx, cy, r = s / 2, s / 2, (s - 2 * pad) / 2 - w / 2
    a = math.radians(330)
    px, py = cx + r * math.cos(a), cy + r * math.sin(a)
    dr = w * 0.95
    d.ellipse([px - dr, py - dr, px + dr, py + dr], fill=INK)
    # stretching figure (lunge with arm overhead), simple strokes
    sc = (s - 2 * pad) / 200
    ox, oy = pad, pad + int(10 * sc)
    P = lambda x, y: (ox + x * sc, oy + y * sc)
    lw = int(14 * sc)
    for a1, a2 in [((100, 70), (100, 118)), ((100, 118), (130, 120)), ((130, 120), (132, 158)),
                   ((100, 118), (76, 140)), ((76, 140), (52, 152)), ((100, 76), (116, 52)), ((116, 52), (124, 30))]:
        d.line([P(*a1), P(*a2)], fill=INK, width=lw, joint="curve")
        for pt in (a1, a2):
            x, y = P(*pt); d.ellipse([x - lw / 2, y - lw / 2, x + lw / 2, y + lw / 2], fill=INK)
    hx, hy = P(96, 52); hr = 13 * sc
    d.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], fill=INK)
    return im.resize((size, size), Image.LANCZOS)

def main():
    shutil.rmtree(DIST, ignore_errors=True); os.makedirs(DIST)
    page = open(SRC, encoding="utf8").read()
    title = re.search(r"<title>(.*?)</title>", page).group(1)
    head = f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0D1015">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Range">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<style>:root{{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0;font:14px system-ui,sans-serif}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
</head><body>
"""
    sw = """<script>if("serviceWorker" in navigator)addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));</script>"""
    open(os.path.join(DIST, "index.html"), "w", encoding="utf8").write(head + page + "\n" + sw + "\n</body></html>\n")
    manifest = {
        "name": title, "short_name": "Range", "start_url": "./", "scope": "./", "display": "standalone",
        "background_color": "#0D1015", "theme_color": "#0D1015", "orientation": "portrait",
        "description": "Mobility tests, stretching protocols around your training, and a guided player.",
        "icons": [
            {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }
    json.dump(manifest, open(os.path.join(DIST, "manifest.webmanifest"), "w"), indent=2)
    icon(192).save(os.path.join(DIST, "icon-192.png"))
    icon(512).save(os.path.join(DIST, "icon-512.png"))
    icon(512, maskable=True).save(os.path.join(DIST, "icon-maskable-512.png"))
    icon(180).save(os.path.join(DIST, "apple-touch-icon.png"))
    version = str(abs(hash(page)) % 10**8)
    open(os.path.join(DIST, "sw.js"), "w").write(open(os.path.join(HERE, "sw.template.js")).read().replace("__VERSION__", version))
    print("Built", DIST)

if __name__ == "__main__":
    main()
