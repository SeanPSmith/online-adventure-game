#!/usr/bin/env bash
# Pass 61B.2: separate, cheaper G6f pilot. Never targets the existing T4 pilot.
set -euo pipefail
export STORY_TIME_GPU_PILOT_VARIANT=budget
exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/story-time-gpu-pilot.sh" "$@"
