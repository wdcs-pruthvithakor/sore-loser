#!/usr/bin/env bash
# Builds dist/sore-loser.zip for itch.io (HTML5, index.html at the zip root).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
rm -f dist/sore-loser.zip
zip -qr dist/sore-loser.zip index.html css js fonts
unzip -l dist/sore-loser.zip
