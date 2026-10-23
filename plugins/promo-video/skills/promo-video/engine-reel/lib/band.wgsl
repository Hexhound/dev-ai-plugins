// A CSS three-stop linear-gradient band across the rect: transparent at stop 0, the colour
// at stop 1, transparent at stop 2, along the gradient line of `angle` (CSS degrees: 90 =
// left to right) with CSS's line length (|w·sin| + |h·cos|). Stops are fractions of that
// line and may lie outside 0…1. Drawn in the rect's own coordinates, so it follows the
// camera. The glass glint, the light wipe's edge.
// params: 0 (angle, stop 0, stop 1, stop 2), 1 (rgba at the peak)
fn shade(p: vec2f, px: vec2f) -> vec4f {
    let s = param(0);
    let a = radians(s.x);
    let dir = vec2f(sin(a), -cos(a));
    let size = reel.rect.zw;
    let len = abs(size.x * sin(a)) + abs(size.y * cos(a));
    let t = dot(p - reel.rect.xy - size * 0.5, dir) / len + 0.5;
    var k = 0.0;
    if (t > s.y && t <= s.z) { k = (t - s.y) / max(s.z - s.y, 1e-5); }
    if (t > s.z && t < s.w) { k = (s.w - t) / max(s.w - s.z, 1e-5); }
    let c = param(1);
    return vec4f(c.rgb, c.a * clamp(k, 0.0, 1.0));
}
