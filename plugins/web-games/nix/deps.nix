# Runtime dependencies for the `web-games` plugin's skills.
# A function `pkgs -> [ derivation ]`; the flake exposes it as `packages.<system>.web-games-deps`.
pkgs: [
  # playgama-console: scripts/render_covers.py screenshots the cover pages with headless
  # chromium and checks them with Pillow.
  (pkgs.python3.withPackages (ps: [ ps.pillow ]))
  pkgs.chromium
]
