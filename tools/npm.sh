#!/bin/bash
# Usage: tools/npm.sh <npm args>   e.g. tools/npm.sh install, tools/npm.sh run build
# Uses Linux npm when installed; otherwise, from WSL, the Windows npm (cmd.exe `pushd`
# maps the WSL share to a temporary drive letter). node_modules then holds Windows binaries.
cd "$(dirname "$0")/.."
if command -v node >/dev/null 2>&1 && [[ "$(command -v npm)" != /mnt/* ]]; then
  exec npm "$@"
fi
WIN_DIR=$(wslpath -w "$PWD" | sed 's|^\\\\wsl\.localhost\\|\\\\wsl$\\|')
[[ "$WIN_DIR" == *" "* ]] && { echo "tools/npm.sh: project path has spaces; run npm from Windows instead" >&2; exit 1; }
cd /mnt/c || exit 1
exec cmd.exe /d /c "set PAW_POLL=1&& pushd $WIN_DIR && npm $* & popd"
