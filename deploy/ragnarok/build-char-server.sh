#!/bin/sh
# Run in python:3.12-slim-bookworm@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258
# Mount engine/rathena read-only at /source and a build output directory at /out.
set -eu
apt-get update -qq >/out/compiler-setup.log 2>&1
apt-get install -y -qq --no-install-recommends build-essential libmariadb-dev libmariadb-dev-compat libpcre3-dev zlib1g-dev libssl-dev >>/out/compiler-setup.log 2>&1
mkdir /build
cp -a /source/. /build/
cd /build
chmod +x configure
./configure --enable-packetver=20211103 --enable-renewal >/out/configure.log 2>&1 || { tail -40 /out/configure.log; exit 1; }
make -j2 char >/out/compile.log 2>&1 || { tail -50 /out/compile.log; exit 1; }
strip --strip-unneeded char-server
cp char-server /out/char-server
sha256sum /out/char-server
