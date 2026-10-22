// CSS radial-gradient(rx ry at cx cy, colour, transparent stop): the colour at the centre,
// fading linearly to nothing at `stop` of the ellipse's radii. glow() in stage.ts.
// params: 0 (centre x, y, rx, ry), 1 (rgba), 2 (stop)
fn shade(p: vec2f, px: vec2f) -> vec4f {
    let e = param(0);
    let d = length((p - e.xy) / max(e.zw, vec2f(1e-3)));
    let c = param(1);
    let stop = max(param(2).x, 1e-3);
    return vec4f(c.rgb, c.a * clamp(1.0 - d / stop, 0.0, 1.0));
}
