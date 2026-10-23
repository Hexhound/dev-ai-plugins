// grain() in material.ts: film grain over whatever is below, new every frame.
// A shader can't read what is under it, so CSS `overlay` is approximated: each pixel is
// white or black with alpha |g - 0.5| · 2 · opacity, which matches overlay on mid-tones
// (a touch stronger on very dark or light ground).
// params: 0 (opacity, seed, 0, 0)
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
    let seed = param(0).y;
    let g = grainAt(px, seed);
    let a = abs(g - 0.5) * 2.0 * param(0).x;
    return vec4f(vec3f(step(0.5, g)), a);
}
