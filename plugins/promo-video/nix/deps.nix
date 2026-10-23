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
  # narrator-vlog: the Kokoro voice runs from a venv (kokoro-onnx, onnxruntime wheels) that
  # voice-setup.sh makes with this python and fills with pip; curl fetches the model.
  pkgs.python3
  pkgs.curl
]
# The video itself is composed in reel (Linux only).
++ pkgs.lib.optional (pkgs ? reel) pkgs.reel
++ pkgs.lib.optionals pkgs.stdenv.hostPlatform.isLinux [
  # Prebuilt Remotion + Playwright node_modules (`promo-video-node-modules` prints its path).
  (pkgs.callPackage ./node-modules.nix {})
  # Remotion renders through `chrome-headless-shell` (Chrome's old headless mode, Playwright's
  # NixOS-patched build). The new headless Chrome (`chromium` above) now and then screenshots
  # a frame before all of it is drawn — blank white tiles, more of them under load — and
  # renders at half the speed.
  (pkgs.writeShellScriptBin "chrome-headless-shell" ''
    exec ${
      pkgs.playwright-driver.browsers.override {
        withChromium = false;
        withFirefox = false;
        withWebkit = false;
        withFfmpeg = false;
      }
    }/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell "$@"
  '')
]
