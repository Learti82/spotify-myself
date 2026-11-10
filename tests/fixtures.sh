#!/usr/bin/env bash
# Generates small tagged audio files for the end-to-end test (requires ffmpeg).
set -euo pipefail
OUT="${1:?output dir}"
mkdir -p "$OUT"
cd "$OUT"
ffmpeg -loglevel error -y -f lavfi -i "color=c=0x2b6cb0:s=300x300,drawbox=x=60:y=60:w=180:h=180:color=0xf6ad55:t=fill" -frames:v 1 cover.png
ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=440:duration=20" -i cover.png -map 0 -map 1 -c:a libmp3lame -b:a 96k -c:v png -disposition:v attached_pic -id3v2_version 3 \
  -metadata title="Morning Light" -metadata artist="Aurora Fields" -metadata album="First Dawn" -metadata genre="Ambient" -metadata date="2021" -metadata track="1" "01 Morning Light.mp3"
ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=523:duration=15" -c:a libmp3lame -b:a 96k -id3v2_version 3 \
  -metadata title="Night Drive" -metadata artist="Aurora Fields" -metadata album="First Dawn" -metadata genre="Synthwave" -metadata date="2019" -metadata track="2" "02 Night Drive.mp3"
ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=330:duration=12" -c:a flac \
  -metadata title="City Rain" -metadata artist="Low Tide" -metadata album="Puddles" -metadata genre="Ambient" -metadata date="1998" city-rain.flac
ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=600:duration=10" -c:a libvorbis \
  -metadata title="Echoes" -metadata artist="Mira" -metadata album="Reflections" echoes.ogg
ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=700:duration=8" "Low Tide - Paper Boats.wav"
printf 'not audio' > notes.txt
ls -1 "$OUT"
