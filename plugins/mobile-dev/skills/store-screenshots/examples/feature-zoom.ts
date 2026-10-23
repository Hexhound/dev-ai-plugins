// EXAMPLE (not a template). Archetype: FEATURE ZOOM: one UI insight recreated large as the
// hero, the device peeking in from the bottom right, copy anchored low. A light, warm
// palette and an off-centre device: deliberately unlike bold-benefit. iPhone 6.7".
//   reel still examples/feature-zoom.ts --at 0 -o feature-zoom.png
import { video, col, row, text, box } from "reel";
import { tracking } from "../lib/stage.ts";

const PHONE = "../assets/models/iphone-12-pro/scene.gltf";
const INK = "#1C1917";

export default video({ width: 1290, height: 2796, duration: 1, motionBlur: false, fonts: ["../assets/fonts/*.ttf"], font: "Inter" }, (cv) => {
  cv.rect(0, 0, 1290, 2796, { gradient: { angle: 160, stops: [["#FDF6EC", 0], ["#FBE4D6", 1]] } });
  // the device, turned 8°, its box bleeding off the right and the bottom
  cv.rotate(8, () => {
    cv.group({ shadow: { y: 50, blur: 100, color: "#78350F48" } }, () => {
      cv.model(PHONE, { rect: [700, 1000, 1000, 2167], screen: "raw/app.png" });
    });
  }, [1200, 2083]);
  // the insight, recreated large
  const bars = [40, 55, 48, 72, 60, 85, 100];
  const card = col(
    [
      text("Saved this year", { size: 44, weight: 600, color: "#78716C" }),
      text("$6,120", { font: "Montserrat", size: 200, weight: 900, lineHeight: 190, letterSpacing: tracking(-6, 200), color: "#0F766E" }),
      row(
        bars.map((h, i) => box(124, 200, (cv, r) => cv.rect(r[0], r[1] + r[3] * (1 - h / 100), r[2], (r[3] * h) / 100, { fill: i === 3 ? "#14B8A6" : i === 6 ? "#0F766E" : "#99F6E4", radius: [16, 16, 0, 0] }))),
        { gap: 16, align: "end" },
      ),
    ],
    { padding: [70, 76], gap: 20, look: { fill: "#fff", radius: 56, shadow: { y: 50, blur: 110, color: "#78350F2E" } } },
  );
  cv.layout(card, 80, 150);
  // the headline and its line, anchored low and clear of the device
  const head = { font: "Montserrat", size: 124, weight: 900, lineHeight: 114, letterSpacing: tracking(-3, 124), color: INK };
  cv.text("WATCH", 80, 1960, head);
  cv.text("SAVINGS", 80, 2074, head);
  cv.text("ADD UP", 80, 2188, head);
  cv.text("Automatic round-ups turn spare change into real money.", 82, 2360, { size: 46, lineHeight: 56, color: "#57534E", width: 560 });
});
