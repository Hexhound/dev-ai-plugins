#!/usr/bin/env python3
"""Renders Playgama cover pages to the exact sizes the "Add Game" form takes, and checks them.

Each input is an HTML page or fragment; its file name says which cover it is:
  *square*     -> 800x800    (Square 1:1)
  *portrait*   -> 1080x1920  (Portrait 9:16)
  *landscape*  -> 1920x1080  (Landscape 16:9)

    render_covers.py covers/cover_square.html covers/cover_portrait.html covers/cover_landscape.html
    render_covers.py covers/*.html --out-dir covers

A fragment is wrapped in a page whose `.stage` element fills the cover (position: relative,
overflow hidden), so absolute children place against it. Local <img src> files are inlined, so
relative and file:// paths both work. Each PNG is checked: exact size, at most 10 MB (else it is
re-saved optimised, then as a high-quality JPEG). Chromium: $CHROMIUM_BIN, else chromium /
chromium-browser / google-chrome on PATH, run with a throwaway profile.
"""
import argparse
import base64
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import unquote, urlparse

SIZES = {"square": (800, 800), "portrait": (1080, 1920), "landscape": (1920, 1080)}
MAX_BYTES = 10 * 1024 * 1024
BASE_CSS = """
html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
.stage { position: relative; width: 100vw; height: 100vh; overflow: hidden; }
"""


def find_chromium() -> str:
    if os.environ.get("CHROMIUM_BIN"):
        return os.environ["CHROMIUM_BIN"]
    for name in ("chromium", "chromium-browser", "google-chrome-stable", "google-chrome"):
        path = shutil.which(name)
        if path:
            return path
    sys.exit("No chromium found. Set CHROMIUM_BIN or install chromium.")


def kind_of(path: str) -> str:
    name = os.path.basename(path).lower()
    for kind in SIZES:
        if kind in name:
            return kind
    sys.exit(f"{path}: the file name must say square, portrait or landscape.")


def inline_files(html: str, base_dir: str) -> str:
    """Local <img src> and <link href> files become data URIs (or inline CSS), so they load."""
    def local(src: str) -> str | None:
        if src.startswith("data:") or src.startswith(("http://", "https://")):
            return None
        if src.startswith("file://"):
            src = unquote(urlparse(src).path)
        path = src if os.path.isabs(src) else os.path.join(base_dir, src)
        return path if os.path.isfile(path) else None

    def image(match: re.Match) -> str:
        path = local(match.group(2))
        if path is None:
            return match.group(0)
        mime = mimetypes.guess_type(path)[0] or "image/png"
        data = base64.b64encode(open(path, "rb").read()).decode()
        return f'{match.group(1)}"data:{mime};base64,{data}"'

    def stylesheet(match: re.Match) -> str:
        path = local(match.group(1))
        if path is None:
            return match.group(0)
        css = open(path).read()
        css_dir = os.path.dirname(path)
        css = re.sub(r"url\(['\"]?([^'\")]+)['\"]?\)",
                     lambda m: f"url('{inline_url(m.group(1), css_dir)}')", css)
        return f"<style>{css}</style>"

    def inline_url(src: str, folder: str) -> str:
        path = local(src) if os.path.isabs(src) or src.startswith("file://") else (
            os.path.join(folder, src) if os.path.isfile(os.path.join(folder, src)) else None)
        if path is None:
            return src
        mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
        return f"data:{mime};base64,{base64.b64encode(open(path, 'rb').read()).decode()}"

    html = re.sub(r'<link[^>]+href=["\']([^"\']+\.css)["\'][^>]*>', stylesheet, html)
    return re.sub(r'(src=)["\']([^"\']+)["\']', image, html)


def build_page(source: str, base_dir: str) -> str:
    body = inline_files(source, base_dir)
    if "<html" in body.lower():
        return re.sub(r"(<head[^>]*>)", r"\1<style>" + BASE_CSS + "</style>", body, count=1,
                      flags=re.IGNORECASE)
    return (f"<!doctype html><html><head><meta charset=utf-8><style>{BASE_CSS}</style>"
            f"</head><body>{body}</body></html>")


def render(chromium: str, source_path: str, out_path: str, width: int, height: int) -> None:
    page = build_page(open(source_path).read(), os.path.dirname(os.path.abspath(source_path)))
    with tempfile.TemporaryDirectory() as work:
        html = os.path.join(work, "page.html")
        with open(html, "w") as f:
            f.write(page)
        for sub in ("home", "config", "cache", "data", "profile", "crash"):
            os.makedirs(os.path.join(work, sub), exist_ok=True)
        env = dict(os.environ, HOME=os.path.join(work, "home"),
                   XDG_CONFIG_HOME=os.path.join(work, "config"),
                   XDG_CACHE_HOME=os.path.join(work, "cache"),
                   XDG_DATA_HOME=os.path.join(work, "data"))
        result = subprocess.run([
            chromium, "--headless=new", "--no-sandbox", "--disable-gpu",
            "--disable-dev-shm-usage", "--hide-scrollbars", "--no-first-run",
            "--no-default-browser-check", "--disable-extensions", "--disable-sync",
            "--force-device-scale-factor=1", f"--window-size={width},{height}",
            f"--user-data-dir={os.path.join(work, 'profile')}",
            f"--crash-dumps-dir={os.path.join(work, 'crash')}",
            f"--screenshot={out_path}", html,
        ], capture_output=True, text=True, env=env)
        if not os.path.isfile(out_path):
            sys.exit(f"Render failed for {source_path}:\n{result.stderr[-800:]}")


def check(out_path: str, width: int, height: int) -> str:
    """Exact size and at most 10 MB; returns the path of the file to upload."""
    from PIL import Image
    image = Image.open(out_path)
    if image.size != (width, height):
        sys.exit(f"{out_path} is {image.size[0]}x{image.size[1]}, not {width}x{height}.")
    if os.path.getsize(out_path) > MAX_BYTES:
        image.save(out_path, optimize=True)
    if os.path.getsize(out_path) > MAX_BYTES:
        jpeg = os.path.splitext(out_path)[0] + ".jpg"
        image.convert("RGB").save(jpeg, quality=92)
        os.remove(out_path)
        out_path = jpeg
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Render Playgama covers at their exact sizes")
    parser.add_argument("inputs", nargs="+", help="cover HTML files (name says square/portrait/landscape)")
    parser.add_argument("--out-dir", default=None, help="where the PNGs go (default: beside each input)")
    args = parser.parse_args()
    chromium = find_chromium()
    for source in args.inputs:
        width, height = SIZES[kind_of(source)]
        folder = args.out_dir or os.path.dirname(os.path.abspath(source))
        os.makedirs(folder, exist_ok=True)
        out = os.path.join(folder, os.path.splitext(os.path.basename(source))[0] + ".png")
        render(chromium, source, out, width, height)
        final = check(out, width, height)
        size_mb = os.path.getsize(final) / 1024 / 1024
        print(f"ok  {final}  {width}x{height}  {size_mb:.1f} MB")


if __name__ == "__main__":
    main()
