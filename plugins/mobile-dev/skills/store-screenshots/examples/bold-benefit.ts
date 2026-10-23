// EXAMPLE (not a template). Archetype: BOLD BENEFIT: a huge verb-led headline up top, the
// device angled below and bleeding off the bottom. iPhone 6.7" (1290 × 2796). Every value
// is bespoke to this fictional app's indigo brand: design yours to match the real app.
//   reel still examples/bold-benefit.ts --at 0 -o bold-benefit.png
import { video } from "reel";
import { glow, tracking } from "../lib/stage.ts";

const PHONE = "../assets/models/iphone-12-pro/scene.gltf";

export default video({ width: 1290, height: 2796, duration: 1, motionBlur: false, fonts: ["../assets/fonts/*.ttf"], font: "Inter" }, (cv) => {
  cv.rect(0, 0, 1290, 2796, { gradient: { angle: 165, stops: [["#111827", 0], ["#1E1B4B", 0.6], ["#312E81", 1]] } });
  glow(cv, 1032, -140, 1400, 1000, "#4F46E5", 0.55);
  cv.text("YOUR MONEY, CLEARLY", 645, 150, { size: 38, weight: 700, color: "#C7D2FE", letterSpacing: tracking(8, 38), anchor: "center" });
  const head = { font: "Montserrat", size: 210, weight: 900, lineHeight: 189, letterSpacing: tracking(-6, 210), anchor: "center" as const };
  cv.text("SEE IT", 645, 230, { ...head, color: "#fff" });
  cv.text([{ text: "ALL " }, { text: "GROW", color: "#A5B4FC" }], 645, 419, { ...head, color: "#fff" });
  // the device: angled, its box 1180 wide from y 760 (it bleeds off the bottom)
  cv.group({ shadow: { y: 60, blur: 120, color: "#00000099" } }, () => {
    cv.model(PHONE, { rect: [55, 760, 1180, 2557], screen: "raw/app.png", yaw: 18, pitch: -6 });
  });
});
