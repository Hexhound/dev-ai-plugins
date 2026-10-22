# Runtime dependencies for the `mobile-dev` plugin's skills.
# A function `pkgs -> [ derivation ]`. The flake auto-discovers this file and exposes
# `packages.<system>.mobile-dev-deps` from it. Add packages here as skills need them.
pkgs: [
  # (store-screenshots renders with reel, its own install: nix profile install
  # github:sezaru/reel)
  # app-demand-scout: its appfigures scripts drive a chromium started with
  # --remote-debugging-port (playwright-core connects over CDP).
  pkgs.chromium
  # guard-log-commands hook (hooks/): parses the PreToolUse payload with jq. The hook
  # fails open (allows everything) if jq is missing, so this keeps the guard live.
  pkgs.jq
  # app-demand-scout: single-file Elixir scripts (scout/review_miner/aso_generator/…) that
  # fetch live App Store/Play/review/trends data. First run pulls `req` via Mix.install.
  pkgs.beamPackages.elixir
]
