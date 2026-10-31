#!/bin/bash
# Copies the built web app (../site) into www/, which Capacitor bundles into the iOS app.
# Build the web app first:  (cd .. && RANGE_DIST=$PWD/site python3 build/build.py)
set -e
cd "$(dirname "$0")"
rm -rf www && mkdir -p www
cp -R ../site/. www/
rm -f www/sw.js www/wod.json   # no service worker in the native shell; the workout feed is read from the web
echo "www/ ready: $(ls www | wc -l) files"
