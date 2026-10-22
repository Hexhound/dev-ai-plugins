import {Config} from '@remotion/cli/config';
import {cpus} from 'node:os';

// NixOS: use the Nix browser; node_modules is a read-only store path, so no webpack cache.
// Render with chrome-headless-shell (CHROMIUM=$(command -v chrome-headless-shell), from the
// plugin's deps): the new headless Chrome (plain `chromium`) now and then screenshots a frame
// before all of it is drawn — blank white tiles, more under load — and takes twice as long.
if (process.env.CHROMIUM) Config.setBrowserExecutable(process.env.CHROMIUM);
Config.setChromeMode(/headless.shell/.test(process.env.CHROMIUM ?? '') ? 'headless-shell' : 'chrome-for-testing');
Config.setCachingEnabled(false);
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setConcurrency(Math.max(2, Math.floor(cpus().length / 2)));
