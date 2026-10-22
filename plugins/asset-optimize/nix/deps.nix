# Runtime dependencies for the `asset-optimize` plugin's skills.
# A function `pkgs -> [ derivation ]`; the flake exposes it as `packages.<system>.asset-optimize-deps`.
pkgs: [
  pkgs.blender
]
