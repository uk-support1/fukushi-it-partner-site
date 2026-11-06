#!/usr/bin/env bash
# フレーム（frames/）と音（audio/）から、MP4を作る。
#   使い方：bash marketing/youtube/ameba-ownd-end-short/build.sh
#   できるもの：ameba-ownd-end-short.mp4（BGM＋ナレーション）。BGMだけの版が要るときは、引数に bgm-only を付ける（例：bash build.sh bgm-only）
set -euo pipefail
cd "$(dirname "$0")"
TOTAL=$(cat audio/total.txt)
FADE=$(awk -v t="$TOTAL" 'BEGIN{printf "%.2f", t-1.4}')
for v in ${1:-narration}; do
  out="ameba-ownd-end-short.mp4"; [ "$v" = "bgm-only" ] && out="ameba-ownd-end-short-bgm-only.mp4"
  ffmpeg -y -loglevel error -framerate 30 -i frames/%05d.png -i "audio/mix-$v.wav" \
    -filter_complex "[1:a]loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=out:st=${FADE}:d=1.4[a]" -map 0:v -map "[a]" \
    -t "$TOTAL" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -movflags +faststart "$out"
  echo "書き出し: $out"
done
