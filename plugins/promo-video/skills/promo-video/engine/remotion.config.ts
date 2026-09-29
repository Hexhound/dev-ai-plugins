import {Config} from '@remotion/cli/config';
import {cpus} from 'node:os';

// NixOS: use the Nix chromium; node_modules is a read-only store path, so no webpack cache.
if (process.env.CHROMIUM) Config.setBrowserExecutable(process.env.CHROMIUM);
Config.setChromeMode('chrome-for-testing');
Config.setCachingEnabled(false);
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setConcurrency(Math.max(2, Math.floor(cpus().length / 2)));
