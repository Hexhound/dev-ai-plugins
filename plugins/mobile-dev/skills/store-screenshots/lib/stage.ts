// Small helpers for store-screenshot scenes (copied into the project by init-screenshots.sh;
// change them freely). Everything else is reel itself: `reel docs`, `reel docs models`.
import { alpha, type Canvas, type Color, type Rect } from "reel";

const GLOW = `${import.meta.dirname}/glow.wgsl`;

/**
 * CSS `radial-gradient(rx ry at cx cy, color, transparent stop)`: a soft light on the
 * background, `stop` (0…1, default 1) the fraction of the radii where it has faded out.
 */
export function glow(cv: Canvas, cx: number, cy: number, rx: number, ry: number, color: Color, stop = 1): void {
  const c = alpha(color, 1);
  const r: Rect = [cx - rx * stop, cy - ry * stop, 2 * rx * stop, 2 * ry * stop];
  cv.shader(GLOW, { rect: r, params: [cx, cy, rx, ry, c[0], c[1], c[2], c[3], stop, 0, 0, 0] });
}

/** CSS letter-spacing in px → reel's (em). */
export const tracking = (px: number, size: number) => px / size;

/** Store sizes (portrait, px). Pass the matching one as the video's width and height. */
export const SIZES = {
  playPhone: [1080, 2160],
  playPhone169: [1080, 1920],
  playTablet: [2048, 2732],
  playFeature: [1024, 500],
  iphone69: [1320, 2868],
  iphone67: [1290, 2796],
  iphone65: [1242, 2688],
  ipad13: [2064, 2752],
  ipad129: [2048, 2732],
} as const;
