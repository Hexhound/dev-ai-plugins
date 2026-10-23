// The demo screenshots the examples put on their devices: a fictional finance app's home
// screen, drawn with reel (a real set uses real captures). 1170 × 2532 (an iPhone 12 Pro's
// screen), or with --set wide=1 2732 × 2048 (an iPad Pro's, landscape). Remake them:
//   reel still examples/raw/app.ts --at 0 -o examples/raw/app.png
//   reel still examples/raw/app.ts --at 0 -o examples/raw/app-wide.png --set wide=1
import { video, params } from "reel";

const WIDE = params.wide === "1";

const INK = "#0F172A";
const MUTED = "#64748B";
const ACCENT = "#4F46E5";

export default video({ width: WIDE ? 2732 : 1170, height: WIDE ? 2048 : 2532, duration: 1, background: "#F8FAFC", motionBlur: false, fonts: ["../../assets/fonts/*.ttf"], font: "Inter" }, (cv) => {
  // status bar
  cv.text("9:41", 90, 52, { size: 46, weight: 600, color: INK });
  cv.rect(cv.width - 190, 64, 90, 40, { radius: 10, border: { width: 4, color: INK } });
  cv.rect(cv.width - 182, 72, 62, 24, { fill: INK, radius: 5 });
  // (wide: the accounts beside the card)
  const [ax, ay] = WIDE ? [1562, -760] : [0, 0];
  cv.text("Good morning, Ana", 80, 210, { size: 46, weight: 500, color: MUTED });
  cv.text("Net worth", 80, 280, { size: 64, weight: 800, color: INK });
  // the balance card
  cv.rect(60, 400, 1050, 560, { gradient: { angle: 135, stops: [["#4F46E5", 0], ["#7C3AED", 1]] }, radius: 56, shadow: { y: 30, blur: 70, color: "#4F46E555" } });
  cv.text("Total balance", 120, 470, { size: 42, weight: 500, color: "#C7D2FE" });
  cv.text("$48,210.35", 120, 530, { size: 120, weight: 800, color: "#fff", letterSpacing: -0.02 });
  cv.text("+ $1,284 this month", 120, 690, { size: 42, weight: 600, color: "#A7F3D0" });
  const bars = [0.42, 0.55, 0.48, 0.66, 0.6, 0.78, 0.92];
  bars.forEach((b, i) => cv.rect(120 + i * 132, 900 - 140 * b, 84, 140 * b, { fill: i === 6 ? "#fff" : "#ffffff55", radius: [14, 14, 4, 4] }));
  // accounts
  cv.text("Accounts", 80 + ax, 1030 + ay, { size: 52, weight: 800, color: INK });
  const rows: [string, string, string, string][] = [
    ["Checking", "Everyday · 4021", "$6,420.18", "#10B981"],
    ["Savings", "High-yield · 1.9%", "$18,950.00", "#4F46E5"],
    ["Brokerage", "Index funds", "$21,705.40", "#F59E0B"],
    ["Credit card", "Due Oct 28", "−$1,865.23", "#EF4444"],
  ];
  rows.forEach(([name, sub, amt, col], i) => {
    const y = 1130 + ay + i * 230;
    cv.translate(ax, 0, () => {
      cv.rect(60, y, 1050, 200, { fill: "#fff", radius: 40, shadow: { y: 8, blur: 24, color: "#0F172A12" } });
      cv.circle(150, y + 100, 46, { fill: col + "22" });
      cv.circle(150, y + 100, 18, col);
      cv.text(name, 230, y + 48, { size: 46, weight: 700, color: INK });
      cv.text(sub, 230, y + 112, { size: 36, weight: 500, color: MUTED });
      cv.text(amt, 1060, y + 70, { size: 46, weight: 700, color: INK, anchor: "end" });
    });
  });
  // tab bar
  const H = cv.height;
  cv.rect(0, H - 232, cv.width, 232, { fill: "#fff", shadow: { y: -6, blur: 30, color: "#0F172A10" } });
  ["Home", "Spend", "Invest", "Me"].forEach((t, i) => {
    const x = (cv.width / 8) * (2 * i + 1);
    cv.circle(x, H - 162, 22, i === 0 ? ACCENT : "#CBD5E1");
    cv.text(t, x, H - 122, { size: 34, weight: 600, color: i === 0 ? ACCENT : MUTED, anchor: "center" });
  });
  cv.rect(cv.width / 2 - 185, H - 42, 370, 14, { fill: INK, radius: 7 });
});
