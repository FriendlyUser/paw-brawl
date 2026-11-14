#!/bin/bash
# Usage: tools/node.sh <script> [args]  — runs a script with node (Windows node.exe from WSL).
cd "$(dirname "$0")/.."
if command -v node >/dev/null 2>&1; then exec node "$@"; fi
WIN_DIR=$(wslpath -w "$PWD" | sed 's|^\\\\wsl\.localhost\\|\\\\wsl$\\|')
cd /mnt/c || exit 1
exec cmd.exe /d /c "pushd $WIN_DIR && node $* & popd"
