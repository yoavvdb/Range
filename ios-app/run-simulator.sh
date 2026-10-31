#!/bin/bash
# Builds Range as a native iOS app and starts it in the iPhone Simulator. Needs a Mac with Xcode.
#   ./run-simulator.sh                 -> iPhone 16
#   ./run-simulator.sh "iPhone 15 Pro"  -> another device (see: xcrun simctl list devices available)
set -e
cd "$(dirname "$0")"
SIM="${1:-iPhone 16}"
BUNDLE="app.range.mobility"

command -v xcodebuild >/dev/null || { echo "Xcode is not installed (xcodebuild not found). Install it from the Mac App Store."; exit 1; }

echo "1/5 Building the web app"
(cd .. && RANGE_DIST="$PWD/site" python3 build/build.py >/dev/null)
echo "2/5 Copying it into the iOS project"
npm install --silent
./sync-web.sh
npx cap sync ios >/dev/null
echo "3/5 Starting the simulator: $SIM"
xcrun simctl boot "$SIM" 2>/dev/null || true
open -a Simulator
echo "4/5 Building the app (the first build takes a few minutes)"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination "platform=iOS Simulator,name=$SIM" -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO -quiet build
APP=$(find build -path "*Debug-iphonesimulator/App.app" -maxdepth 6 | head -1)
echo "5/5 Installing and launching"
xcrun simctl install booted "$APP"
xcrun simctl launch booted "$BUNDLE"
echo "Range is running in the simulator."
