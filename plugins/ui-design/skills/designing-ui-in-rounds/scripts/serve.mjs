#!/usr/bin/env node
// Serves a design export over HTTP. Pages that load .jsx through in-browser
// Babel refuse to run from file://.
// Usage: node serve.mjs <folder> [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const port = Number(process.argv[3] ?? 8765);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".jsx": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

http
  .createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(req.url.split("?")[0]));
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        "content-type": types[path.extname(file)] ?? "application/octet-stream",
      });
      res.end(data);
    });
  })
  .listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
