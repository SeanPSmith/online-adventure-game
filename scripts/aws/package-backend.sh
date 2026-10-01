#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
OUT_DIR="$ROOT/.aws-build"
ARCHIVE="$OUT_DIR/backend-source.zip"

mkdir -p "$OUT_DIR"
rm -f "$ARCHIVE"

cd "$ROOT"

for required in app requirements.txt requirements-aws.txt Dockerfile buildspec.yml; do
  if [[ ! -e "$required" ]]; then
    echo "Missing required backend build input: $required" >&2
    exit 2
  fi
done

zip -qr "$ARCHIVE" \
  app \
  requirements.txt \
  requirements-aws.txt \
  Dockerfile \
  buildspec.yml \
  -x '*/__pycache__/*' '*.pyc' 'data/*' 'backups/*' 'tests/*'

printf 'Created: %s\n' "$ARCHIVE"
unzip -l "$ARCHIVE" | tail -n 5
