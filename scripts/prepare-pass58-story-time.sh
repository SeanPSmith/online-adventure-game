#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../frontend"
npm uninstall kokoro-js
# The retired worker has no imports, but remove its obsolete source after install.
rm -f src/services/storyTimeWorker.ts
npm run build
printf '\nHosted Story Time frontend prepared. No AWS changes made.\n'
