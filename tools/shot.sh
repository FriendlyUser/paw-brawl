#!/bin/bash
# Usage: tools/shot.sh "<url path+query>" [out.png] [wait_ms] [WxH]
# Screenshots the built game (served on :8791) with headless Windows Chrome.
URL="http://localhost:8791/$1"
OUT="${2:-shot.png}"
WAIT="${3:-6000}"
SIZE="${4:-1280,720}"
RUN="pb_$$_$RANDOM"
WIN_DIR='C:\Users\Public\pb_runs'
mkdir -p /mnt/c/Users/Public/pb_runs
"/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist \
  --autoplay-policy=no-user-gesture-required --user-data-dir="$WIN_DIR\\$RUN" --window-size=$SIZE --virtual-time-budget=$WAIT \
  --run-all-compositor-stages-before-draw --screenshot="$WIN_DIR\\$RUN.png" "$URL" >/dev/null 2>&1
cp "/mnt/c/Users/Public/pb_runs/$RUN.png" "$OUT" 2>/dev/null || echo "shot.sh: no screenshot produced" >&2
rm -rf "/mnt/c/Users/Public/pb_runs/$RUN" "/mnt/c/Users/Public/pb_runs/$RUN.png"
