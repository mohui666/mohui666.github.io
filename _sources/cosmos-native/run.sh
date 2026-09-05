#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
export QT_QPA_PLATFORM=xcb
export QT_XCB_GL_INTEGRATION=xcb_glx
export PYOPENGL_PLATFORM=glx
exec .venv/bin/python -m cosmos_native "$@"
