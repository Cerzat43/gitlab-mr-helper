#!/usr/bin/env bash
# Claude Code project status line for tampermonkey-gitlab.
# Output (two lines):
#   Line 1: [<Model>] 🌿 <branch>
#   Line 2: <progress-bar> <ctx>% context | $<cost> | <Nm Ns>
# The progress bar colour follows context usage: green <70%, yellow 70-89%, red >=90%.

set -eu

input="$(cat)"

# JSON fields (with safe fallbacks for null / absent values).
MODEL=$(printf '%s' "$input" | jq -r '.model.display_name // "?"')
PCT=$(printf '%s' "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
COST=$(printf '%s' "$input" | jq -r '.cost.total_cost_usd // 0')
DURATION_MS=$(printf '%s' "$input" | jq -r '.cost.total_duration_ms // 0')

# Current branch.
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"

# Colours.
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
RESET='\033[0m'

# Progress bar colour follows context usage thresholds.
if [ "$PCT" -ge 90 ]; then
    BAR_COLOR="$RED"
elif [ "$PCT" -ge 70 ]; then
    BAR_COLOR="$YELLOW"
else
    BAR_COLOR="$GREEN"
fi

# 10-char progress bar: ▓ for filled, ░ for empty.
FILLED=$((PCT / 10))
EMPTY=$((10 - FILLED))
BAR=""
[ "$FILLED" -gt 0 ] && printf -v FILL "%${FILLED}s" && BAR="${FILL// /▓}"
[ "$EMPTY" -gt 0 ] && printf -v PAD "%${EMPTY}s" && BAR="${BAR}${PAD// /░}"

# Cost and duration formatting. LC_ALL=C forces a dot as decimal separator
# (avoids "comma vs dot" failures under locales like fr_FR).
COST_FMT=$(LC_ALL=C printf '$%.2f' "$COST")
DURATION_SEC=$((DURATION_MS / 1000))
MINS=$((DURATION_SEC / 60))
SECS=$((DURATION_SEC % 60))

# Two-line output. printf '%b' interprets \033[... escape sequences reliably across shells.
printf '%b' "${CYAN}[$MODEL]${RESET} 🌿 $branch\n"
printf '%b' "${BAR_COLOR}${BAR}${RESET} ${PCT}% context | ${YELLOW}${COST_FMT}${RESET} | ${MINS}m ${SECS}s\n"
