// backdrop() in material.ts: a base colour, soft coloured lights (CSS radial-gradient
// circles, colour at the centre to transparent at 65%, blurred σ = blur px, at the layer
// opacity in their alpha), a dark vignette (ellipse at centre, transparent at 40%), and
// living film grain blended as CSS `overlay` (here it can be: the shader owns the colour).
// params: 0 (base rgb, vignette), 1 (grain, seed, light count, blur σ),
//         2 + 2i (centre x, y, radius where it reaches transparent, 0), 3 + 2i (rgba)
fn ramp(r: f32, R: f32) -> f32 { return clamp(1.0 - r / R, 0.0, 1.0); }

// PCG integer hash: reel's hash() leaves a woven pattern on whole-pixel lattices
fn pcg(v: u32) -> u32 {
    let s = v * 747796405u + 2891336453u;
    let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
    return (w >> 22u) ^ w;
}
// grey grain 0…1 (triangular, centred on 0.5) for an output pixel and a seed
fn grainAt(px: vec2f, seed: f32) -> f32 {
    let q = vec2u(max(floor(px), vec2f(0.0)));
    let h = pcg(q.x + pcg(q.y + pcg(u32(seed))));
    let a = f32(h & 0xFFFFu) / 65535.0;
    let b = f32(h >> 16u) / 65535.0;
    return 0.5 + 0.5 * (a + b - 1.0);
}

fn shade(p: vec2f, px: vec2f) -> vec4f {
    var c = param(0).rgb;
    let n = i32(param(1).z);
    let sigma = max(param(1).w, 0.001);
    for (var i = 0; i < n; i++) {
        let l = param(2 + 2 * i);
        let col = param(3 + 2 * i);
        let r = length(p - l.xy);
        // the linear ramp blurred along the radius (a 1D Gaussian, 13 taps over ±3σ)
        var acc = 0.0;
        var wsum = 0.0;
        for (var k = -6; k <= 6; k++) {
            let x = f32(k) * sigma * 0.5;
            let w = exp(-0.5 * f32(k * k) * 0.25);
            acc += w * ramp(abs(r + x), l.z);
            wsum += w;
        }
        c = mix(c, col.rgb, col.a * acc / wsum);
    }
    // vignette: farthest-corner ellipse, transparent at 40% → black·v at 100%
    let size = reel.rect.zw;
    let q = (p - reel.rect.xy - size * 0.5) / (size * 0.5 * 1.41421356);
    c = mix(c, vec3f(0.0), param(0).w * clamp((length(q) - 0.4) / 0.6, 0.0, 1.0));
    // grain: grey noise per output pixel, new every frame, blended as overlay
    let g0 = param(1).x;
    if (g0 > 0.0) {
        let seed = param(1).y;
        let g = grainAt(px, seed);
        let ov = mix(2.0 * c * g, 1.0 - 2.0 * (1.0 - c) * (1.0 - g), step(vec3f(0.5), c));
        c = mix(c, ov, g0);
    }
    return vec4f(c, 1.0);
}
