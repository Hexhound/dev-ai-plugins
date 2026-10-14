#!/usr/bin/env node
// Generate a 3D model on hi3d.ai from an image and save the GLB the viewer loads.
//
// Signs up a brand-new account through a throwaway mail.tm inbox (each account gets
// 110 credits, one generation costs 65), uploads the image, waits for the generation and
// captures the finished model off the wire. Progress goes to stderr; a JSON summary of
// the saved files goes to stdout.
//
//   hi3d-generate --image fox.png --out models/fox/ [--headed] [--keep-open]

import { createHash, randomBytes } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

// playwright-core is CommonJS and found through NODE_PATH, which ESM imports ignore.
const { chromium } = createRequire(import.meta.url)("playwright-core");

const SITE = "https://www.hi3d.ai";
const MAIL_API = "https://api.mail.tm";
const MODEL_URL = /\/target\/model\/[^?]+\.glb(\?|$)/;

const { values: args } = parseArgs({
  options: {
    image: { type: "string" },
    out: { type: "string" },
    headed: { type: "boolean", default: false },
    "keep-open": { type: "boolean", default: false },
    "timeout-min": { type: "string", default: "20" },
  },
});
if (!args.image || !args.out) {
  console.error("usage: hi3d-generate --image <jpg|png|webp> --out <dir/ | file.glb> [--headed] [--keep-open]");
  process.exit(2);
}

const log = (msg) => console.error(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- mail.tm: free disposable inboxes over REST, 8 req/s per IP --------------------------

async function mailApi(path, init = {}, attempt = 0) {
  const res = await fetch(MAIL_API + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 429 && attempt < 5) {
    await sleep(1000 * 2 ** attempt);
    return mailApi(path, init, attempt + 1);
  }
  if (!res.ok) throw new Error(`mail.tm ${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function createInbox() {
  // The active domain rotates, so look it up on every run.
  const domains = await mailApi("/domains");
  const domain = domains["hydra:member"].find((d) => d.isActive && !d.isPrivate)?.domain;
  if (!domain) throw new Error("mail.tm has no active public domain right now");

  const address = `hi3d-${randomBytes(6).toString("hex")}@${domain}`;
  const password = randomBytes(12).toString("hex");
  await mailApi("/accounts", { method: "POST", body: JSON.stringify({ address, password }) });
  const { token } = await mailApi("/token", { method: "POST", body: JSON.stringify({ address, password }) });
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  return {
    address,
    password,
    async waitForCode(timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        // Newest first: after a resend only the latest code is valid.
        const messages = (await mailApi("/messages", auth))["hydra:member"].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
        for (const { id } of messages) {
          const msg = await mailApi(`/messages/${id}`, auth);
          const code = [msg.subject, msg.text, ...(msg.html ?? [])].join("\n").match(/\b(\d{6})\b/)?.[1];
          if (code) return code;
        }
        await sleep(2000);
      }
      return undefined;
    },
  };
}

// --- hi3d -----------------------------------------------------------------------------------

async function until(check, timeoutMs, what) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check().catch(() => false)) return;
    await sleep(500);
  }
  throw new Error(`timed out after ${timeoutMs / 1000}s waiting for ${what}`);
}

async function signUp(page, inbox) {
  await page.goto(SITE);
  const login = page.getByRole("button", { name: "Log in", exact: true });
  const email = page.getByPlaceholder("Email");
  // The SSR'd button is clickable before Nuxt hydrates it; early clicks do nothing.
  await until(
    async () => {
      await login.click({ timeout: 5000 });
      await email.waitFor({ state: "visible", timeout: 2000 });
      return true;
    },
    30_000,
    "the login dialog",
  );
  await email.fill(inbox.address);

  // hi3d sometimes accepts the send but the mail never arrives; resend like a user would.
  const send = page.getByText("Send", { exact: true });
  let code;
  for (let attempt = 1; !code && attempt <= 3; attempt++) {
    await send.click({ timeout: 90_000 });
    code = await inbox.waitForCode(75_000);
    if (!code) log(`no code after attempt ${attempt}${attempt < 3 ? ", resending" : ""}`);
  }
  if (!code) throw new Error(`no verification code reached ${inbox.address}`);
  log(`code ${code}`);

  await page.getByPlaceholder(/6-digit code/i).fill(code);
  await page.getByText("Continue", { exact: true }).click();
  await login.waitFor({ state: "hidden", timeout: 30_000 });
}

async function generate(page, image, timeoutMs) {
  await page.goto(`${SITE}/workspace?panel=generate-3d`);
  await page.locator("input.generate-sidebar__file-input").setInputFiles(image);
  const button = page.getByRole("button", { name: /^Generate/ });
  await until(() => button.isEnabled(), 60_000, "the Generate button to enable");
  await button.click();

  // The history thumbnail is labelled with its progress ("… 87%") while running, and with the model version when done.
  const done = page.getByRole("button", { name: /^3D model thumbnail v\d/ });
  const thumbnail = page.getByRole("button", { name: /^3D model thumbnail/ }).first();
  const deadline = Date.now() + timeoutMs;
  let last = "";
  while (!(await done.isVisible())) {
    if (Date.now() > deadline) throw new Error(`generation not finished after ${timeoutMs / 60_000} min`);
    const progress = (await thumbnail.ariaSnapshot({ timeout: 2000 }).catch(() => "")).match(/(\d+)%/)?.[1];
    if (progress && progress !== last) log(`generating ${(last = progress)}%`);
    await sleep(5000);
  }
  // The viewer streams the model in ("Model Loading... N%") before its toolbar shows up.
  await page.getByRole("main").getByRole("button", { name: "Download", exact: true }).waitFor({ timeout: 180_000 });
}

// --- main ---------------------------------------------------------------------------------

const image = resolve(args.image);
if (!/\.(jpe?g|png|webp)$/i.test(image)) throw new Error("hi3d takes JPG, PNG or WEBP images");
if ((await stat(image)).size > 20e6) throw new Error("hi3d takes images up to 20 MB");

const glbPath = args.out.toLowerCase().endsWith(".glb")
  ? resolve(args.out)
  : join(resolve(args.out), `${basename(image, extname(image))}.glb`);
const metaPath = glbPath.replace(/\.glb$/i, ".meta.json");
const shotPath = glbPath.replace(/\.glb$/i, ".viewer.png");
await mkdir(dirname(glbPath), { recursive: true });

const startedAt = new Date();
const inbox = await createInbox();
log(`inbox ${inbox.address}`);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, headless: !args.headed });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(15_000);

// A fresh account gets a "Getting Started" tour, sometimes a feature promo modal, and an upsell carousel over the viewer.
await page.addLocatorHandler(page.getByRole("button", { name: "Skip", exact: true }), (b) => b.click());
await page.addLocatorHandler(
  page.locator(".app-feature-dialog").getByRole("button", { name: "close", exact: true }),
  (b) => b.click(),
);
await page.addLocatorHandler(
  page.getByRole("main").getByRole("region").getByRole("button", { name: "Close", exact: true }),
  (b) => b.click(),
);

// The viewer fetches the finished model from the CDN and only keeps it in memory, and the ~50 MB body is too big
// for Chromium's inspector buffer. So fetch it ourselves and hand the same bytes to the viewer.
const models = [];
await page.route(MODEL_URL, async (route) => {
  const response = await route.fetch({ timeout: 5 * 60_000 });
  const body = await response.body();
  if (response.ok()) models.push({ url: route.request().url(), body });
  await route.fulfill({ response, body });
});

try {
  await signUp(page, inbox);
  log("signed up, uploading image");
  await generate(page, image, Number(args["timeout-min"]) * 60_000);

  const model = models.at(-1);
  if (!model) throw new Error("the viewer never fetched a .glb");
  const glb = model.body;
  if (glb.subarray(0, 4).toString("latin1") !== "glTF") throw new Error("the model is not a binary glTF");
  if (glb.readUInt32LE(8) !== glb.length) throw new Error("the GLB is truncated");

  const url = new URL(model.url);
  await writeFile(glbPath, glb);
  await page.screenshot({ path: shotPath });
  const meta = {
    image,
    model: glbPath,
    viewer: shotPath,
    bytes: glb.length,
    sha256: createHash("sha256").update(glb).digest("hex"),
    task: url.pathname.match(/\/([0-9a-f]{32})\//)?.[1],
    source: url.origin + url.pathname,
    // The mail.tm login, to read the inbox; hi3d accounts are all `hi3d-…@<mail.tm domain>`.
    account: { address: inbox.address, password: inbox.password },
    startedAt: startedAt.toISOString(),
    minutes: +((Date.now() - startedAt) / 60_000).toFixed(1),
  };
  await writeFile(metaPath, JSON.stringify(meta, null, 2));
  log(`saved ${glbPath} (${(glb.length / 1e6).toFixed(1)} MB)`);
  console.log(JSON.stringify({ model: glbPath, meta: metaPath, viewer: shotPath, bytes: glb.length }));

  if (args.headed && args["keep-open"]) {
    log("leaving the browser open; close its window to finish");
    await page.waitForEvent("close", { timeout: 0 });
  }
} catch (err) {
  const failure = glbPath.replace(/\.glb$/i, ".failure.png");
  await page.screenshot({ path: failure }).catch(() => {});
  log(`failed (screenshot: ${failure}; inbox ${inbox.address} / ${inbox.password})`);
  throw err;
} finally {
  await browser.close().catch(() => {});
}
