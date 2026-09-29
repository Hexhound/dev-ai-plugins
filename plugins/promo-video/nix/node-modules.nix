# Remotion + Playwright node_modules, prebuilt so a promo project needs no `npm install`:
# `init-video.sh` symlinks it in. Remotion's native compositor (a Rust binary shipping its
# own ffmpeg libraries) is patched here so direct renders work on NixOS.
{
  lib,
  stdenv,
  importNpmLock,
  nodejs_22,
  autoPatchelfHook,
  zlib,
  writeShellScriptBin,
  symlinkJoin,
}: let
  modules = importNpmLock.buildNodeModules {
    npmRoot = ./node;
    nodejs = nodejs_22;
    derivationArgs = {
      nativeBuildInputs = [autoPatchelfHook];
      buildInputs = [stdenv.cc.cc.lib zlib];
      # npm installs musl builds of native packages beside the glibc ones; never loaded.
      preFixup = ''
        find $out/node_modules -maxdepth 2 -type d -name '*-musl' -prune -exec rm -rf {} +
      '';
    };
  };
  locate = writeShellScriptBin "promo-video-node-modules" ''
    echo ${modules}/node_modules
  '';
in
  symlinkJoin {
    name = "promo-video-node-modules";
    paths = [locate];
    passthru = {inherit modules;};
    meta.platforms = lib.platforms.linux;
  }
