set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"

OUTPUT_DIR="$PROJECT_ROOT/_packages"
STAGING_DIR="$(mktemp -d)"
PACKAGE_ROOT="$STAGING_DIR/$PROJECT_NAME"
OUTPUT_FILE="$OUTPUT_DIR/${PROJECT_NAME}-review-${TIMESTAMP}.zip"

cleanup() {
    rm -rf "$STAGING_DIR"
}

trap cleanup EXIT

mkdir -p "$OUTPUT_DIR"
mkdir -p "$PACKAGE_ROOT"

echo
echo "Packaging project for review..."
echo "Source: $PROJECT_ROOT"
echo

rsync -a \
    --exclude='.git/' \
    --exclude='.github/cache/' \
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
    --exclude='dist/' \
    --exclude='build/' \
    --exclude='coverage/' \
    --exclude='cdk.out/' \
    --exclude='.vite/' \
    --exclude='.cache/' \
    --exclude='backups/' \
    --exclude='snapshot*/' \
    --exclude='_packages/' \
    --exclude='*.zip' \
    --exclude='*.tar' \
    --exclude='*.tar.gz' \
    --exclude='*.log' \
    --exclude='*.sqlite' \
    --exclude='*.sqlite3' \
    --exclude='*.db' \
    --exclude='.env' \
    --exclude='.env.*' \
    --exclude='!.env.example' \
    --exclude='*.pem' \
    --exclude='*.key' \
    --exclude='*.crt' \
    --exclude='*.p12' \
    --exclude='*.pfx' \
    --exclude='credentials' \
    --exclude='credentials.*' \
    "$PROJECT_ROOT/" "$PACKAGE_ROOT/"

echo "Creating zip..."

(
    cd "$STAGING_DIR"
    zip -qr "$OUTPUT_FILE" "$PROJECT_NAME"
)

SIZE="$(du -h "$OUTPUT_FILE" | cut -f1)"

echo
echo "Done."
echo
echo "Package:"
echo "  $OUTPUT_FILE"
echo
echo "Size:"
echo "  $SIZE"
echo
echo "Excluded:"
echo "  dependencies, builds, caches, backups, git history,"
echo "  databases, logs, credentials, certificates and .env files."
echo
