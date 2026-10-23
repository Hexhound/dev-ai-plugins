# Runtime dependencies for the `mobile-dev` plugin's skills.
# A function `pkgs -> [ derivation ]`. The flake auto-discovers this file and exposes
# `packages.<system>.mobile-dev-deps` from it. Add packages here as skills need them.
pkgs:
[
  # app-demand-scout: its appfigures scripts drive a chromium started with
  # --remote-debugging-port (playwright-core connects over CDP).
  pkgs.chromium
  # guard-log-commands hook (hooks/): parses the PreToolUse payload with jq. The hook
  # fails open (allows everything) if jq is missing, so this keeps the guard live.
  pkgs.jq
  # app-demand-scout: single-file Elixir scripts (scout/review_miner/aso_generator/…) that
  # fetch live App Store/Play/review/trends data. First run pulls `req` via Mix.install.
  pkgs.beamPackages.elixir
  # store-privacy-site: scripts/pages.py is stdlib python3 (Pillow resizes the site icon); it
  # deploys with `npx wrangler@latest`, which needs node. play-publish: scripts/play_publish.py
  # signs the service-account JWT (cryptography) and calls the Play Developer API (requests).
  (pkgs.python3.withPackages (ps: [
    ps.requests
    ps.cryptography
    ps.pillow
  ]))
  pkgs.nodejs
]
# store-screenshots composes in reel (Linux only).
++ pkgs.lib.optional (pkgs ? reel) pkgs.reel
