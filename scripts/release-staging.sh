#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo
echo "============================================================"
echo " TALES OF TWO // STAGING RELEASE"
echo "============================================================"
echo

# ------------------------------------------------------------
# 1. Verify the project before touching Git or AWS.
# ------------------------------------------------------------

echo "==> Running complete project verification..."
echo

./scripts/check-project.sh

echo
echo "==> Project verification passed."
echo

# ------------------------------------------------------------
# 2. Make sure we're inside a Git repository.
# ------------------------------------------------------------

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "ERROR: This project is not inside a Git repository."
    exit 1
fi

BRANCH="$(git branch --show-current)"

if [[ -z "$BRANCH" ]]; then
    echo "ERROR: Git is currently in detached HEAD state."
    exit 1
fi

echo "==> Current Git branch: $BRANCH"
echo

# ------------------------------------------------------------
# 3. Save the exact version we're about to deploy.
# ------------------------------------------------------------

if [[ -n "$(git status --porcelain)" ]]; then
    echo "==> Changes detected."
    echo

    git status --short
    echo

    git add -A

    # Allow:
    #
    # ./scripts/release-staging.sh "Fix Director retry flow"
    #
    # Otherwise generate a useful release commit automatically.

    if [[ $# -gt 0 ]]; then
        COMMIT_MESSAGE="$*"
    else
        COMMIT_MESSAGE="Staging release $(date '+%Y-%m-%d %H:%M:%S')"
    fi

    echo "==> Creating Git commit:"
    echo "    $COMMIT_MESSAGE"
    echo

    git commit -m "$COMMIT_MESSAGE"
else
    echo "==> No uncommitted changes. Using existing HEAD."
    echo
fi

# ------------------------------------------------------------
# 4. Push the exact release commit to GitHub.
# ------------------------------------------------------------

echo "==> Pushing $BRANCH to GitHub..."
echo

git push origin "$BRANCH"

echo
echo "==> GitHub backup complete."
echo

COMMIT_SHA="$(git rev-parse --short HEAD)"

echo "==> Release commit: $COMMIT_SHA"
echo

# ------------------------------------------------------------
# 5. Deploy that same source tree to AWS.
# ------------------------------------------------------------

echo "==> Beginning AWS staging deployment..."
echo

./scripts/aws/deploy-game-staging.sh

echo
echo "============================================================"
echo " STAGING RELEASE COMPLETE"
echo " Commit: $COMMIT_SHA"
echo " Branch: $BRANCH"
echo "============================================================"
echo Deplo

