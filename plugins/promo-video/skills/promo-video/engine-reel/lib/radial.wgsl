// A CSS radial-gradient ramp: the colour at the centre to transparent at the ellipse
// (rx, ry), linearly. flash() and glow() in material.ts.
// params: 0 (centre x, y, rx, ry), 1 (rgba at the centre)
fn shade(p: vec2f, px: vec2f) -> vec4f {
    let e = param(0);
    let d = length((p - e.xy) / max(e.zw, vec2f(1e-3)));
    let c = param(1);
    return vec4f(c.rgb, c.a * clamp(1.0 - d, 0.0, 1.0));
}
