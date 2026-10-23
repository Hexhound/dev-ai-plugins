// EXAMPLE (not a template). Archetype: CONTEXT on a tablet: copy on one side, the angled
// landscape device filling the other, a line of proof. iPad 13"/12.9" landscape
// (2732 × 2048): the device turned with orient: "landscape", a landscape screenshot on it.
//   reel still examples/ipad-landscape.ts --at 0 -o ipad-landscape.png
import { video } from "reel";
import { glow, tracking } from "../lib/stage.ts";

const IPAD = "../assets/models/ipad-pro-12-9/scene.gltf";

export default video({ width: 2732, height: 2048, duration: 1, motionBlur: false, fonts: ["../assets/fonts/*.ttf"], font: "Inter" }, (cv) => {
  cv.rect(0, 0, 2732, 2048, { gradient: { angle: 120, stops: [["#0B1220", 0], ["#1E293B", 1]] } });
  glow(cv, 2868, 2253, 1600, 1200, "#4F46E5", 0.5);
  cv.group({ shadow: { y: 70, blur: 130, color: "#00000099" } }, () => {
    cv.model(IPAD, { rect: [1260, 300, 2100, 1575], screen: "raw/app-wide.png", orient: "landscape", yaw: -16, pitch: -4 });
  });
  cv.text("EVERYTHING IN ONE PLACE", 180, 300, { size: 44, weight: 700, color: "#A5B4FC", letterSpacing: tracking(7, 44) });
  const head = cv.text([{ text: "YOUR WHOLE " }, { text: "NET WORTH", color: "#818CF8" }], 180, 400, {
    font: "Montserrat", size: 170, weight: 900, lineHeight: 160, letterSpacing: tracking(-4, 170), color: "#fff", width: 1040,
  });
  // the line under it, wherever the headline ended
  cv.text("Accounts, cash and investments, tracked together and updated live.", 180, 400 + head.height + 50, { size: 54, lineHeight: 68, color: "#CBD5E1", width: 880 });
  [["3.2M", "people tracking"], ["4.9★", "App Store"]].forEach(([n, l], i) => {
    cv.text(n, 184 + i * 420, 1660, { font: "Montserrat", size: 110, weight: 900, color: "#fff" });
    cv.text(l, 184 + i * 420, 1790, { size: 40, color: "#94A3B8" });
  });
});
