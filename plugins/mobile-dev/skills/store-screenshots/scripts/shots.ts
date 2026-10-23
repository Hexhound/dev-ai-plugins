// The screenshot set: one frame per shot, a marker naming each (written as final/NAME.png).
//   reel check shots.ts · reel sheet shots.ts --count N --cols N · reel still shots.ts --at markers -o final/
// A starting point only: design every shot for this app (SKILL.md → DESIGN GUIDELINES).
import { video, params } from "reel";
import { glow, SIZES } from "./lib/stage.ts";

const DEVICE = "models/@MODEL@/scene.gltf";
const [W, H] = SIZES.playPhone;
const SHOTS = ["hero"] as const;
const LANG = params.lang ?? "en";

export default video(
  { width: W, height: H, duration: SHOTS.length, motionBlur: false, background: "#FFFFFF",
    fonts: ["fonts/*.ttf"], font: "Inter", lang: LANG,
    markers: Object.fromEntries(SHOTS.map((s, i) => [s, i])) },
  (cv, f) => {
    const shot = SHOTS[Math.round(f)];
    if (shot === "hero") {
      glow(cv, W * 0.8, -100, 1100, 900, "#4F46E5", 0.6);
      cv.text("VERB-LED BENEFIT", W / 2, 180, { font: "Montserrat", size: 110, weight: 900, anchor: "center", color: "#111827", width: W - 140, align: "center" });
      cv.group({ shadow: { y: 50, blur: 100, color: "#00000040" } }, () => {
        cv.model(DEVICE, { rect: [60, 480, W - 120, H - 420], screen: `raw/${LANG}/hero.png` });
      });
    }
  },
);
