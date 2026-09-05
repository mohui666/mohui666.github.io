#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
sudo apt-get update
sudo apt-get install -y python3-venv gcc g++ make git autoconf automake libtool \
  libhdf5-dev libfftw3-dev libgsl-dev libnuma-dev libxcb-cursor0 \
  libxkbcommon-x11-0 libxcb-icccm4 libxcb-keysyms1 libxcb-xkb1
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/fetch_data.py
mkdir -p vendor runs
if [ ! -d vendor/swift ]; then
  git clone --depth 1 --branch v2026.04 https://github.com/SWIFTSIM/SWIFT.git vendor/swift
fi
cd vendor/swift
./autogen.sh
./configure --disable-mpi --with-hydro=remix --with-equation-of-state=planetary \
  --with-kernel=wendland-C2 --disable-fof --disable-hand-vec \
  --with-hdf5=/usr/bin/h5cc --disable-doxygen-doc
make -j 8
