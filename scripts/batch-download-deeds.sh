#!/bin/bash
# Batch download electronic-only deeds from ROD viewer and convert to PDF
# Each deed: download PNGs → combine into single PDF → clean up PNGs
#
# Requires: ROD_USERNAME, ROD_PASSWORD env vars
#           Node.js, sips (macOS)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_BASE="/tmp/rod-downloads"
FINAL_DIR="$HOME/Desktop/ROD-Electronic-Deeds"

mkdir -p "$FINAL_DIR"

# Define deeds to download: instId|filename|maxPages
DEEDS=(
  "2145824|2008-02-13 DEED Adams to Adams JTWROS 26.6ac Old Hotel Ct - Book 2312 p1611|5"
  "4464597|2024-05-01 QCD Brunson Jr to Brunson Family Trust - Book 2718 p1538|5"
  "3823931|2020-11-16 DEED Finley to Arms 0.58ac Old Hotel Ct - Book 2608 p4692|5"
  "1406431|2002-05-01 DEED Broadbent to Trust 0.74ac Bull Estate - Book 1993 p200|5"
  "1406581|2002-05-01 DEED Broadbent to Trust 12.64ac E Main St - Book 1993 p300|5"
  "3259612|2017-10-02 DEED Bull Estate to Eero James Tracts 1-4 - Book 2522 p4401|10"
  "4492547|2024-08-13 DEED Eero James to TTS 8.62ac - Book 2727 p4086|10"
  "4311813|2023-03-01 DEED Microtex to Eve SC 4.89ac - Book 2681 p5132|5"
)

cd "$REPO_DIR"

for entry in "${DEEDS[@]}"; do
  IFS='|' read -r instId filename maxPages <<< "$entry"
  dir="$OUTPUT_BASE/$instId"
  pdf="$FINAL_DIR/${filename}.pdf"

  if [ -f "$pdf" ]; then
    echo "SKIP: $filename (already exists)"
    continue
  fi

  echo "Downloading: $filename (instId $instId)..."
  node scripts/download-deed-pages.mjs "$instId" "$dir" "$maxPages"

  # Count pages
  count=$(ls "$dir"/page-*.png 2>/dev/null | wc -l | tr -d ' ')
  if [ "$count" -eq 0 ]; then
    echo "  ERROR: no pages downloaded"
    continue
  fi

  # Convert PNGs to single PDF using sips + Preview
  # sips can't make multi-page PDFs, so use Python
  python3 -c "
from PIL import Image
import glob, sys

pngs = sorted(glob.glob('$dir/page-*.png'))
if not pngs:
    sys.exit(1)

images = [Image.open(p).convert('RGB') for p in pngs]
images[0].save('$pdf', save_all=True, append_images=images[1:], resolution=150)
print(f'  Created PDF: {len(images)} pages')
" 2>/dev/null || {
    # Fallback if Pillow not available: just keep PNGs
    echo "  Pillow not available, keeping PNGs"
    mkdir -p "$FINAL_DIR/$(basename "$dir")"
    cp "$dir"/page-*.png "$FINAL_DIR/$(basename "$dir")/"
  }

  # Clean up PNGs
  rm -rf "$dir"
done

echo ""
echo "=== Results ==="
ls -lh "$FINAL_DIR"/*.pdf 2>/dev/null || echo "No PDFs created (check if Pillow is installed: pip3 install Pillow)"
