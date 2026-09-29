# Runtime dependencies for the `promo-video` plugin's skill.
# A function `pkgs -> [ derivation ]`; the flake exposes it as `packages.<system>.promo-video-deps`.
pkgs:
[
  # Remotion runs on node and renders through chromium; the capture adapters drive
  # chromium too (web apps, via playwright-core).
  pkgs.nodejs_22
  pkgs.chromium
  # Music: beat tracking (aubiotrack), loudness + muxing (ffmpeg), JSON glue (jq).
  pkgs.aubio
  pkgs.ffmpeg-headless
  pkgs.jq
  # Frame conversion and contact sheets.
  pkgs.imagemagick
]
++ pkgs.lib.optionals pkgs.stdenv.hostPlatform.isLinux [
  # Prebuilt Remotion + Playwright node_modules (`promo-video-node-modules` prints its path).
  (pkgs.callPackage ./node-modules.nix {})
]
