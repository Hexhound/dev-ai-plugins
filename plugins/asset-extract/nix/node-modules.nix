# playwright-core, prebuilt so the hi3d skill needs no `npm install`. Pure JS: it drives
# the Nix chromium from deps.nix, never a downloaded browser.
{
  importNpmLock,
  nodejs_22,
  writeShellScriptBin,
}: let
  modules = importNpmLock.buildNodeModules {
    npmRoot = ./node;
    nodejs = nodejs_22;
  };
in
  writeShellScriptBin "asset-extract-node-modules" ''
    echo ${modules}/node_modules
  ''
