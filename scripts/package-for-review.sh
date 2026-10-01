#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_NAME="$(basename "$ROOT_DIR")"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
OUTPUT_DIR="$ROOT_DIR/_packages"
STAGING_DIR="$(mktemp -d)"
PACKAGE_ROOT="$STAGING_DIR/$PROJECT_NAME"
OUTPUT_FILE="$OUTPUT_DIR/${PROJECT_NAME}-review-${TIMESTAMP}.zip"

cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: required command not found: $1" >&2
    exit 1
  }
}

require_command rsync
require_command zip

mkdir -p "$OUTPUT_DIR" "$PACKAGE_ROOT"

echo "Packaging source snapshot for review..."
echo "Source: $ROOT_DIR"

rsync -a \
  --exclude='.git/' \
  --exclude='.DS_Store' \
  --exclude='__MACOSX/' \
  --exclude='node_modules/' \
  --exclude='.venv/' \
  --exclude='venv/' \
  --exclude='env/' \
  --exclude='__pycache__/' \
  --exclude='.pytest_cache/' \
  --exclude='.mypy_cache/' \
  --exclude='.ruff_cache/' \
  --exclude='.coverage' \
  --exclude='htmlcov/' \
  --exclude='coverage/' \
  --exclude='dist/' \
  --exclude='build/' \
  --exclude='cdk.out/' \
  --exclude='.vite/' \
  --exclude='.cache/' \
  --exclude='backups/' \
  --exclude='_packages/' \
  --exclude='*.zip' \
  --exclude='*.tar' \
  --exclude='*.tar.gz' \
  --exclude='*.log' \
  --exclude='*.sqlite' \
  --exclude='*.sqlite3' \
  --exclude='*.db' \
  --include='.env.example' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='*.pem' \
  --exclude='*.key' \
  --exclude='*.crt' \
  --exclude='*.p12' \
  --exclude='*.pfx' \
  --exclude='credentials' \
  --exclude='credentials.*' \
  "$ROOT_DIR/" "$PACKAGE_ROOT/"

(
  cd "$STAGING_DIR"
  zip -qr "$OUTPUT_FILE" "$PROJECT_NAME"
)

SIZE="$(du -h "$OUTPUT_FILE" | cut -f1)"

echo
echo "Review package ready:"
echo "  $OUTPUT_FILE"
echo "  $SIZE"
