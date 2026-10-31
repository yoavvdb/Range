#!/bin/bash
# Copies a built web app into www/, which Capacitor bundles into the iOS app.
#   ./sync-web.sh            -> from ../site (the committed build)
#   ./sync-web.sh build/web  -> from another folder (run-simulator.sh builds fresh into this one)
set -e
cd "$(dirname "$0")"
rm -rf www && mkdir -p www
cp -R "${1:-../site}/." www/
rm -f www/sw.js www/wod.json   # no service worker in the native shell; the workout feed is read from the web
echo "www/ ready: $(ls www | wc -l) files"
