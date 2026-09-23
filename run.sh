#!/usr/bin/env bash
# Double-click / terminal entry point for macOS and Linux -- the counterpart to
# run.bat. Starts the zero-dependency static server (stdlib Python 3 only, no
# installs) and opens the app in the default browser.
set -euo pipefail

cd "$(dirname "$0")"

# `python` is still Python 2 on some systems, so check the interpreter's major
# version rather than trusting its name.
find_python() {
    local candidate
    for candidate in python3 python; do
        if command -v "$candidate" >/dev/null 2>&1 &&
            "$candidate" -c 'import sys; raise SystemExit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then
            printf '%s\n' "$candidate"
            return 0
        fi
    done
    return 1
}

if ! PYTHON="$(find_python)"; then
    echo "Python 3 was not found on this computer."
    echo
    echo "  macOS:          brew install python3"
    echo "                  (or download from https://www.python.org/downloads/)"
    echo "  Debian/Ubuntu:  sudo apt install python3"
    echo "  Fedora/RHEL:    sudo dnf install python3"
    echo "  Arch:           sudo pacman -S python"
    echo
    # Mirrors run.bat's `pause` so a double-clicked window does not vanish
    # before the message can be read -- but only when someone is watching.
    if [ -t 0 ]; then
        read -r -p "Press Enter to close..." _
    fi
    exit 1
fi

exec "$PYTHON" server/run_server.py
