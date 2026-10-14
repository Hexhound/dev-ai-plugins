#!/usr/bin/env python3
"""Find and pull 3D models out of a Firefox-family browser (Zen, Firefox, LibreWolf, Floorp).

A web 3D viewer downloads the whole model file (GLB, glTF, FBX, OBJ, ...) before it can
show it, so the file usually sits in the browser's disk cache. This reads the open tabs
from the session store and the cache2 entries straight from disk; the browser itself is
never touched.

  tabs      open tabs, most recently used first
  scan      cached entries that look like 3D models
  refs      model URLs mentioned in cached API/HTML responses (for models not cached)
  extract   write a cached model out (decoded, meshopt unpacked for Blender)
  info      summary of a .glb/.gltf (meshes, vertices, materials, textures)
  textures  unpack the images embedded in a .glb
  preview   4-angle PNG turntable of a model, to check it without a GPU or a window
"""

import argparse
import gzip
import io
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import time
import zlib
from pathlib import Path
from urllib.parse import urljoin, urlsplit

HOME = Path.home()
XDG_CONFIG = Path(os.environ.get("XDG_CONFIG_HOME") or HOME / ".config")
XDG_CACHE = Path(os.environ.get("XDG_CACHE_HOME") or HOME / ".cache")

# Directories that hold Firefox-family profiles (each profile is a subdirectory).
PROFILE_ROOTS = [
    XDG_CONFIG / "zen",
    HOME / ".zen",
    XDG_CONFIG / "mozilla/firefox",
    HOME / ".mozilla/firefox",
    XDG_CONFIG / "librewolf",
    HOME / ".librewolf",
    HOME / ".floorp",
    HOME / ".waterfox",
    HOME / ".var/app/app.zen_browser.zen/.zen",
    HOME / ".var/app/org.mozilla.firefox/.mozilla/firefox",
    HOME / "Library/Application Support/zen/Profiles",
    HOME / "Library/Application Support/Firefox/Profiles",
]

MODEL_EXT = re.compile(r"\.(glb|gltf|vrm|fbx|obj|stl|ply|usdz|usdc|usd|3mf|dae|3ds|drc|splat|ksplat|spz)$", re.I)
MODEL_URL = re.compile(
    r"https?://[^\s\"'<>\\]+?\.(?:glb|gltf|vrm|fbx|obj|stl|ply|usdz|3mf|splat|ksplat|spz)(?:\?[^\s\"'<>\\]*)?",
    re.I,
)
MAGIC = [
    (b"glTF", "glb"),
    (b"Kaydara FBX Binary", "fbx"),
    (b"ply\n", "ply"),
    (b"ply\r\n", "ply"),
    (b"DRACO", "draco"),
]
CHUNK = 256 * 1024  # cache2 hashes the body in chunks of this size


def die(msg):
    sys.exit(f"error: {msg}")


def fmt_time(t):
    return time.strftime("%m-%d %H:%M:%S", time.localtime(t))


def fmt_size(n):
    return f"{n / 1e6:7.1f}M" if n >= 1e5 else f"{n / 1e3:7.1f}K"


# --- profiles ---------------------------------------------------------------------------


def find_profiles():
    found = []
    for root in PROFILE_ROOTS:
        if not root.is_dir():
            continue
        for p in root.iterdir():
            if p.is_dir() and (p / "prefs.js").exists():
                found.append(p)
    return found


def session_file(profile):
    for name in ("recovery.jsonlz4", "recovery.baklz4", "previous.jsonlz4"):
        f = profile / "sessionstore-backups" / name
        if f.exists():
            return f
    f = profile / "sessionstore.jsonlz4"  # written on clean shutdown
    return f if f.exists() else None


def pick_profile(arg):
    if arg and Path(arg).expanduser().is_dir():
        return Path(arg).expanduser()
    profiles = find_profiles()
    if arg:
        profiles = [p for p in profiles if arg.lower() in str(p).lower()]
    if not profiles:
        die("no Firefox-family profile found; pass --profile <dir>")
    # The running profile is the one whose session store was written last.
    return max(profiles, key=lambda p: session_file(p).stat().st_mtime if session_file(p) else 0)


def cache_dir(profile, arg):
    if arg:
        d = Path(arg).expanduser()
        return d / "entries" if (d / "entries").is_dir() else d
    profile = profile.resolve()
    candidates = [profile / "cache2"]
    try:
        rel = profile.relative_to(HOME).parts
        if rel[:1] == (".config",):
            rel = rel[1:]
        rel = (rel[0].lstrip("."),) + rel[1:]
        candidates += [XDG_CACHE.joinpath(*rel, "cache2"), HOME.joinpath(".cache", *rel, "cache2")]
        if "Application Support" in rel:
            i = rel.index("Application Support")
            candidates.append(HOME.joinpath("Library/Caches", *rel[i + 1 :], "cache2"))
    except ValueError:
        pass
    for c in candidates:
        if (c / "entries").is_dir():
            return c / "entries"
    die(f"no cache2 dir for {profile}; tried {', '.join(map(str, candidates))}. Pass --cache <dir>")


# --- session store ----------------------------------------------------------------------


def lz4_block(src):
    """Plain LZ4 block decompression, enough for mozlz4 session files."""
    dst = bytearray()
    i, n = 0, len(src)
    while i < n:
        tok = src[i]
        i += 1
        lit = tok >> 4
        if lit == 15:
            while True:
                b = src[i]
                i += 1
                lit += b
                if b != 255:
                    break
        dst += src[i : i + lit]
        i += lit
        if i >= n:
            break
        off = src[i] | src[i + 1] << 8
        i += 2
        ml = tok & 15
        if ml == 15:
            while True:
                b = src[i]
                i += 1
                ml += b
                if b != 255:
                    break
        ml += 4
        start = len(dst) - off
        if off >= ml:
            dst += dst[start : start + ml]
        else:  # overlapping match repeats the last `off` bytes
            for k in range(ml):
                dst.append(dst[start + k])
    return bytes(dst)


def read_mozlz4(path):
    data = path.read_bytes()
    if data[:8] != b"mozLz40\0":
        die(f"{path} is not a mozlz4 file")
    return json.loads(lz4_block(data[12:]))


def cmd_tabs(a):
    profile = pick_profile(a.profile)
    sf = session_file(profile)
    if not sf:
        die(f"no session store in {profile}")
    tabs = []
    for w in read_mozlz4(sf).get("windows", []):
        for ti, t in enumerate(w.get("tabs", [])):
            entries = t.get("entries") or [{}]
            e = entries[max(t.get("index", 1), 1) - 1] if len(entries) >= t.get("index", 1) else entries[-1]
            selected = ti + 1 == w.get("selected")
            tabs.append((t.get("lastAccessed", 0) / 1000, selected, e.get("title", ""), e.get("url", "")))
    if a.grep:
        rx = re.compile(a.grep, re.I)
        tabs = [t for t in tabs if rx.search(t[2]) or rx.search(t[3])]
    tabs.sort(reverse=True)
    print(f"# profile {profile} ({len(tabs)} tabs, * = selected in its window)")
    for t, sel, title, url in tabs[: a.limit]:
        print(f"{fmt_time(t)} {'*' if sel else ' '} {title[:70]}\n{'':17}{url[:200]}")


# --- cache2 entries ---------------------------------------------------------------------


def parse_entry(path):
    """Metadata plus the first bytes of the body, without reading the whole body."""
    try:
        with open(path, "rb") as f:
            f.seek(0, 2)
            total = f.tell()
            if total < 4:
                return None
            f.seek(total - 4)
            size = struct.unpack(">I", f.read(4))[0]
            if size > total - 4:
                return None
            f.seek(size)
            meta = f.read(total - 4 - size)
            f.seek(0)
            head = f.read(32)
    except OSError:
        return None
    p = 4 + 2 * ((size + CHUNK - 1) // CHUNK)  # metadata hash + per-chunk hashes
    if len(meta) < p + 28:
        return None
    version = struct.unpack(">I", meta[p : p + 4])[0]
    key_size = struct.unpack(">I", meta[p + 24 : p + 28])[0]
    p += 32 if version >= 2 else 28
    key = meta[p : p + key_size].decode("utf-8", "replace")
    elems = meta[p + key_size + 1 :].split(b"\0")
    elems = dict(zip(elems[0::2], elems[1::2]))
    m = re.search(r":(https?://.*)$", key)
    if not m:
        return None
    rh = elems.get(b"response-head", b"").decode("latin-1")
    hdr = {}
    for line in rh.split("\r\n")[1:]:
        k, _, v = line.partition(":")
        hdr[k.strip().lower()] = v.strip()
    status = rh.split(" ", 2)[1] if rh.count(" ") >= 1 else "?"
    return {
        "hash": path.name,
        "path": str(path),
        "mtime": path.stat().st_mtime,
        "size": size,
        "url": m.group(1),
        "status": status,
        "ctype": hdr.get("content-type", ""),
        "cenc": hdr.get("content-encoding", "").lower(),
        "clen": int(hdr["content-length"]) if hdr.get("content-length", "").isdigit() else None,
        "head": head[:32],
    }


def all_entries(entries_dir):
    out = []
    for p in entries_dir.iterdir():
        e = parse_entry(p)
        if e:
            out.append(e)
    return out


def classify(e):
    path = urlsplit(e["url"]).path
    m = MODEL_EXT.search(path)
    if not e["cenc"]:
        for magic, kind in MAGIC:
            if e["head"].startswith(magic):
                return kind
    ct = e["ctype"].split(";")[0].strip().lower()
    if ct == "model/gltf-binary":
        return "glb"
    if ct == "model/gltf+json":
        return "gltf"
    if m:
        return m.group(1).lower()
    if ct.startswith("model/"):
        return ct[6:]
    return None


def completeness(e, kind):
    if e["status"] == "206":
        return "partial"
    if kind in ("glb", "vrm") and not e["cenc"] and e["head"][:4] == b"glTF":
        return "ok" if struct.unpack("<I", e["head"][8:12])[0] == e["size"] else "TRUNC"
    if e["clen"] is not None and not e["cenc"]:
        return "ok" if e["clen"] == e["size"] else "TRUNC"
    return "?"


def decode_body(e):
    data = Path(e["path"]).read_bytes()[: e["size"]]
    enc = e["cenc"]
    if not enc or enc == "identity":
        return data
    if enc in ("gzip", "x-gzip"):
        return gzip.decompress(data)
    if enc == "deflate":
        try:
            return zlib.decompress(data)
        except zlib.error:
            return zlib.decompress(data, -15)
    if enc == "br":
        try:
            import brotli
        except ImportError:
            die("body is brotli-encoded; needs the python `brotli` module")
        return brotli.decompress(data)
    if enc == "zstd":
        try:
            import zstandard
        except ImportError:
            die("body is zstd-encoded; needs the python `zstandard` module")
        return zstandard.ZstdDecompressor().stream_reader(io.BytesIO(data)).read()
    die(f"unknown content-encoding {enc!r}")


def find_entry(entries_dir, prefix):
    hits = [p for p in entries_dir.iterdir() if p.name.lower().startswith(prefix.lower())]
    if len(hits) != 1:
        die(f"{len(hits)} cache entries match {prefix!r}")
    e = parse_entry(hits[0])
    if not e:
        die(f"could not parse cache entry {hits[0]}")
    return e


def filtered(entries, a):
    if a.since:
        cutoff = time.time() - a.since * 60
        entries = [e for e in entries if e["mtime"] >= cutoff]
    if a.grep:
        rx = re.compile(a.grep, re.I)
        entries = [e for e in entries if rx.search(e["url"])]
    return entries


def cmd_scan(a):
    profile = pick_profile(a.profile)
    edir = cache_dir(profile, a.cache)
    rows = []
    for e in filtered(all_entries(edir), a):
        kind = classify(e)
        if kind or a.all:
            rows.append((e, kind or "-", completeness(e, kind)))
    rows.sort(key=lambda r: r[0]["mtime"])
    if a.json:
        print(json.dumps([{**{k: v for k, v in e.items() if k != "head"}, "kind": k, "complete": c} for e, k, c in rows], indent=1))
        return
    print(f"# cache {edir}  (oldest first; hash prefix is enough for `extract`)")
    for e, kind, ok in rows:
        u = urlsplit(e["url"])
        path = u.path if len(u.path) <= 90 else "…" + u.path[-89:]
        print(f"{e['hash'][:12]} {fmt_time(e['mtime'])} {fmt_size(e['size'])} {kind:6} {ok:7} {u.netloc} {path}")
    if not rows:
        print("no model-like entries; try without --since/--grep, `--all`, or the `refs` command")


def cmd_refs(a):
    profile = pick_profile(a.profile)
    edir = cache_dir(profile, a.cache)
    textual = re.compile(r"json|html|text/plain" + (r"|javascript" if a.include_js else ""), re.I)
    seen = {}
    for e in filtered(all_entries(edir), argparse.Namespace(since=a.since, grep=None)):
        if not textual.search(e["ctype"]) or e["size"] > 20e6:
            continue
        try:
            text = decode_body(e).decode("utf-8", "replace")
        except (SystemExit, Exception):
            continue
        text = text.replace("\\/", "/").replace("\\u0026", "&").replace("&amp;", "&")
        for url in MODEL_URL.findall(text):
            if a.grep and not re.search(a.grep, url, re.I):
                continue
            if url not in seen or seen[url]["mtime"] < e["mtime"]:
                seen[url] = e
    for url, e in sorted(seen.items(), key=lambda kv: kv[1]["mtime"]):
        print(f"{fmt_time(e['mtime'])} in {e['hash'][:12]} ({urlsplit(e['url']).netloc})\n  {url}")
    if not seen:
        print("no model URLs found in cached responses")


# --- glTF -------------------------------------------------------------------------------


def read_gltf(path):
    """(json, binary chunk or None) for a .glb/.vrm or .gltf file."""
    data = Path(path).read_bytes()
    if data[:4] != b"glTF":
        return json.loads(data), None
    length = struct.unpack("<I", data[8:12])[0]
    if length != len(data):
        print(f"warning: GLB header says {length} bytes, file has {len(data)} (truncated?)", file=sys.stderr)
    jl = struct.unpack("<I", data[12:16])[0]
    j = json.loads(data[20 : 20 + jl])
    b = 20 + jl
    binary = data[b + 8 : b + 8 + struct.unpack("<I", data[b : b + 4])[0]] if len(data) > b + 8 else None
    return j, binary


def image_bytes(j, binary, img):
    if "bufferView" not in img or binary is None:
        return None
    bv = j["bufferViews"][img["bufferView"]]
    s = bv.get("byteOffset", 0)
    return binary[s : s + bv["byteLength"]]


def cmd_info(a):
    summarize(a.file)


def summarize(path):
    j, binary = read_gltf(path)
    acc = j.get("accessors", [])
    verts = tris = 0
    for m in j.get("meshes", []):
        for p in m.get("primitives", []):
            if "POSITION" in p.get("attributes", {}):
                verts += acc[p["attributes"]["POSITION"]]["count"]
            if p.get("mode", 4) == 4:
                n = acc[p["indices"]]["count"] if "indices" in p else acc[p["attributes"]["POSITION"]]["count"]
                tris += n // 3
    print(f"{path}: {Path(path).stat().st_size / 1e6:.1f} MB")
    print(f"  generator   {j.get('asset', {}).get('generator', '?')}")
    print(f"  extensions  {', '.join(j.get('extensionsUsed', [])) or '-'}")
    print(f"  meshes {len(j.get('meshes', []))}, vertices {verts:,}, triangles {tris:,}, materials {len(j.get('materials', []))}")
    for i, img in enumerate(j.get("images", [])):
        data = image_bytes(j, binary, img)
        dims = ""
        if data:
            try:
                from PIL import Image

                Image.MAX_IMAGE_PIXELS = None
                dims = "%dx%d" % Image.open(io.BytesIO(data)).size
            except Exception:
                pass
        src = img.get("uri", "embedded")[:60]
        print(f"  image {i}: {img.get('name', '')} {img.get('mimeType', '')} {dims} {src}")
    return j


def needs_decoding(j):
    return {"EXT_meshopt_compression", "KHR_meshopt_compression"} & set(j.get("extensionsUsed", []))


def unpack_meshopt(src, dst):
    """Rewrite a meshopt-compressed/quantized glTF as plain glTF most importers read."""
    if not shutil.which("gltfpack"):
        print("warning: gltfpack (meshoptimizer) not on PATH; left meshopt-compressed", file=sys.stderr)
        return False
    # -noq: no quantization; -kn/-km/-ke: keep nodes, materials, extras as they are.
    subprocess.run(["gltfpack", "-i", str(src), "-o", str(dst), "-noq", "-kn", "-km", "-ke", "-vpf"], check=True)
    return True


# --- extract ----------------------------------------------------------------------------


def safe_name(url, fallback):
    name = Path(urlsplit(url).path).name or fallback
    return re.sub(r"[^\w.\-]+", "_", name)


def cmd_extract(a):
    profile = pick_profile(a.profile)
    edir = cache_dir(profile, a.cache)
    e = find_entry(edir, a.hash)
    kind = classify(e) or "bin"
    data = decode_body(e)
    print(f"# {e['url'][:160]}")
    out = Path(a.out).expanduser()
    if kind == "gltf":
        extract_gltf(edir, e, data, out)
        return
    if out.is_dir() or a.out.endswith("/"):
        out.mkdir(parents=True, exist_ok=True)
        out = out / safe_name(e["url"], f"model.{kind}")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(data)
    ok = completeness(e, kind)
    if ok != "ok":
        print(f"warning: entry looks {ok} (cached {e['size']} bytes, content-length {e['clen']})", file=sys.stderr)
    if kind not in ("glb", "vrm"):
        print(f"wrote {out} ({len(data) / 1e6:.1f} MB, {kind})")
        return
    j = summarize(out)
    if needs_decoding(j) and not a.keep_compressed:
        packed = out.with_name(out.stem + ".meshopt" + out.suffix)
        out.rename(packed)
        if unpack_meshopt(packed, out):
            print(f"meshopt-compressed: unpacked to {out}, original kept as {packed.name}")
            summarize(out)
        else:
            packed.rename(out)
    if "KHR_draco_mesh_compression" in j.get("extensionsUsed", []):
        print("note: Draco-compressed geometry; Blender imports it natively, some other tools don't")


def extract_gltf(edir, e, data, out):
    """A .gltf is JSON pointing at sibling .bin/texture files; pull those from the cache too."""
    out.mkdir(parents=True, exist_ok=True)
    j = json.loads(data)
    by_url = {}
    for x in all_entries(edir):
        u = urlsplit(x["url"])
        key = u.scheme + "://" + u.netloc + u.path
        if key not in by_url or by_url[key]["mtime"] < x["mtime"]:
            by_url[key] = x
    missing = []
    for item in j.get("buffers", []) + j.get("images", []):
        uri = item.get("uri")
        if not uri or uri.startswith("data:"):
            continue
        u = urlsplit(urljoin(e["url"], uri))
        dep = by_url.get(u.scheme + "://" + u.netloc + u.path)
        target = (out / uri.split("?")[0]).resolve()
        if dep is None or not target.is_relative_to(out.resolve()):
            missing.append(uri)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(decode_body(dep))
    main = out / safe_name(e["url"], "model.gltf")
    main.write_bytes(data)
    summarize(main)
    for uri in missing:
        print(f"missing from cache: {uri}  (open the model in the viewer again, then re-run)")


# --- textures / preview -----------------------------------------------------------------

ROLES = [
    ("pbrMetallicRoughness", "baseColorTexture", "basecolor"),
    ("pbrMetallicRoughness", "metallicRoughnessTexture", "metallic_roughness"),
    (None, "normalTexture", "normal"),
    (None, "occlusionTexture", "occlusion"),
    (None, "emissiveTexture", "emissive"),
]
MIME_EXT = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/ktx2": "ktx2"}


def cmd_textures(a):
    j, binary = read_gltf(a.file)
    out = Path(a.out).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    textures = j.get("textures", [])
    names = {}
    mats = j.get("materials", [])
    for mi, m in enumerate(mats):
        for parent, slot, role in ROLES:
            ref = (m.get(parent, {}) if parent else m).get(slot)
            if ref is None:
                continue
            t = textures[ref["index"]]
            src = t.get("source")
            for ext in t.get("extensions", {}).values():  # webp/basisu textures keep the source here
                src = ext.get("source", src)
            if src is not None:
                names.setdefault(src, role if len(mats) == 1 else f"mat{mi}_{role}")
    for i, img in enumerate(j.get("images", [])):
        data = image_bytes(j, binary, img)
        if data is None:
            print(f"image {i}: external file {img.get('uri')}, already separate")
            continue
        p = out / f"{names.get(i, f'image{i}')}.{MIME_EXT.get(img.get('mimeType'), 'bin')}"
        p.write_bytes(data)
        print(p)


def cmd_preview(a):
    try:
        import numpy as np
        import trimesh
        from PIL import Image
    except ImportError as err:
        die(f"preview needs numpy, pillow and trimesh ({err})")
    try:
        j, _ = read_gltf(a.file)
        if needs_decoding(j):
            die("meshopt-compressed; preview the unpacked file `extract` wrote")
    except (json.JSONDecodeError, UnicodeDecodeError):
        pass  # not glTF; trimesh handles OBJ/STL/PLY/...
    m = trimesh.load(a.file, force="mesh")
    v = m.vertices - m.bounds.mean(0)
    n = m.vertex_normals
    try:
        col = m.visual.to_color().vertex_colors[:, :3] / 255.0
    except Exception:
        col = np.full((len(v), 3), 0.8)
    size = a.size
    panels = []
    for ang in (0, 90, 180, 270):
        r = np.radians(ang)
        rot = np.array([[np.cos(r), 0, np.sin(r)], [0, 1, 0], [-np.sin(r), 0, np.cos(r)]])
        p, nn = v @ rot.T, n @ rot.T
        sc = size * 0.45 / np.abs(p[:, :2]).max()
        x = (p[:, 0] * sc + size / 2).astype(int)
        y = (size / 2 - p[:, 1] * sc).astype(int)
        order = np.argsort(p[:, 2])  # far to near, so near points win
        img = np.ones((size, size, 3))
        c = col * np.clip(0.35 + 0.65 * np.clip(nn[:, 2], 0, 1), 0, 1)[:, None]
        for dx in (0, 1):
            for dy in (0, 1):
                img[np.clip(y + dy, 0, size - 1)[order], np.clip(x + dx, 0, size - 1)[order]] = c[order]
        panels.append(img)
    out = Path(a.out).expanduser()
    Image.fromarray((np.hstack(panels) * 255).astype(np.uint8)).save(out)
    print(f"{out}  ({len(m.vertices):,} vertices, {len(m.faces):,} faces; views at 0/90/180/270 deg around Y)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--profile", help="profile dir, or a substring of its path (default: most recently used)")
    ap.add_argument("--cache", help="cache2 dir, when it isn't found from the profile")
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("tabs", help="open tabs, most recently used first")
    s.add_argument("--grep", help="regex on title or URL")
    s.add_argument("--limit", type=int, default=20)
    s.set_defaults(fn=cmd_tabs)

    s = sub.add_parser("scan", help="cached entries that look like 3D models")
    s.add_argument("--grep", help="regex on the entry URL (model CDNs are often not the page's host)")
    s.add_argument("--since", type=float, help="only entries cached in the last N minutes")
    s.add_argument("--all", action="store_true", help="list every entry, not just model-like ones")
    s.add_argument("--json", action="store_true")
    s.set_defaults(fn=cmd_scan)

    s = sub.add_parser("refs", help="model URLs mentioned in cached JSON/HTML responses")
    s.add_argument("--grep", help="regex on the found URL")
    s.add_argument("--since", type=float, help="only responses cached in the last N minutes")
    s.add_argument("--include-js", action="store_true", help="also search JavaScript bundles (noisy)")
    s.set_defaults(fn=cmd_refs)

    s = sub.add_parser("extract", help="write a cached model out")
    s.add_argument("hash", help="cache entry hash or unique prefix, from `scan`")
    s.add_argument("-o", "--out", required=True, help="output file, or a directory (always a directory for .gltf)")
    s.add_argument("--keep-compressed", action="store_true", help="don't unpack meshopt compression")
    s.set_defaults(fn=cmd_extract)

    s = sub.add_parser("info", help="summarize a .glb/.gltf")
    s.add_argument("file")
    s.set_defaults(fn=cmd_info)

    s = sub.add_parser("textures", help="unpack the images embedded in a .glb")
    s.add_argument("file")
    s.add_argument("-o", "--out", required=True, help="output directory")
    s.set_defaults(fn=cmd_textures)

    s = sub.add_parser("preview", help="4-angle PNG turntable of a model")
    s.add_argument("file")
    s.add_argument("-o", "--out", required=True, help="output .png")
    s.add_argument("--size", type=int, default=600, help="pixels per view")
    s.set_defaults(fn=cmd_preview)

    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
