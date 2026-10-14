# Runtime dependencies for the `asset-extract` plugin's skills.
# A function `pkgs -> [ derivation ]`; the flake exposes it as `packages.<system>.asset-extract-deps`.
pkgs: [
  (pkgs.python3.withPackages (p: [
    # zstd / brotli: cached bodies keep their HTTP content-encoding.
    p.zstandard
    p.brotli
    # Image sizes, texture unpacking and the turntable preview.
    p.pillow
    p.numpy
    p.trimesh
    p.scipy
    p.networkx
  ]))
  # gltfpack unpacks meshopt-compressed GLBs, which Blender can't import.
  pkgs.meshoptimizer
  # hi3d-generate: drives chromium through playwright-core (`asset-extract-node-modules`
  # prints its path).
  pkgs.nodejs_22
  pkgs.chromium
  (pkgs.callPackage ./node-modules.nix {})
]
