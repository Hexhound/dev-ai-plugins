#!/usr/bin/env python3
"""Cloudflare Pages helper for an app's store site (home page + privacy policy).

Usage:
  pages.py create <project>                      classic Pages project, production branch main
  pages.py deploy <project> <site-dir>           wrangler pages deploy, run from inside <site-dir>
  pages.py domain <project> <hostname>           attach a custom domain (e.g. <project>.hexhound.dev)
  pages.py status <project>                      the project's domains and their status
  pages.py verify <base-url> [--email ADDRESS]   GET /, /privacy-policy, /icon.png

Why a script and not plain wrangler: since wrangler 4.147 `pages project create` makes a
Worker, not a classic Pages project, and wrangler has no command to attach a Pages custom
domain. Both go straight to the Cloudflare API here, with wrangler's own OAuth login
(`npx wrangler@latest login`) or CLOUDFLARE_API_TOKEN. Stdlib only.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request

API = "https://api.cloudflare.com/client/v4"
WRANGLER = ["npx", "--yes", "wrangler@latest"]
# pages.dev answers 403 to urllib's default User-Agent; a browser one gets the real page.
BROWSER_UA = {"User-Agent": "Mozilla/5.0"}


def die(message):
    print(message, file=sys.stderr)
    sys.exit(1)


def wrangler_config():
    """Where wrangler keeps its login, found the way wrangler finds it: ~/.wrangler when that
    folder exists, else .wrangler in the config folder ($XDG_CONFIG_HOME, or the platform's)."""
    home = os.path.expanduser("~")
    folder = os.path.join(home, ".wrangler")
    if not os.path.isdir(folder):
        if os.environ.get("XDG_CONFIG_HOME"):
            config = os.environ["XDG_CONFIG_HOME"]
        elif sys.platform == "darwin":
            config = os.path.join(home, "Library", "Preferences")
        elif os.name == "nt":
            appdata = os.environ.get("APPDATA") or os.path.join(home, "AppData", "Roaming")
            config = os.path.join(appdata, "xdg.config")
        else:
            config = os.path.join(home, ".config")
        folder = os.path.join(config, ".wrangler")
    return os.path.join(folder, "config", "default.toml")


def token():
    if os.environ.get("CLOUDFLARE_API_TOKEN"):
        return os.environ["CLOUDFLARE_API_TOKEN"]
    try:
        match = re.search(r'^oauth_token = "([^"]+)"', open(wrangler_config()).read(), re.M)
    except FileNotFoundError:
        match = None
    if not match:
        die("Not logged in to Cloudflare. Ask the user to run: ! npx wrangler@latest login")
    return match.group(1)


def refresh_login():
    # The OAuth token lasts about an hour; any authenticated wrangler command refreshes it.
    subprocess.run(WRANGLER + ["whoami"], capture_output=True)


def api(method, path, body=None, retried=False):
    request = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {token()}", "Content-Type": "application/json"},
    )
    try:
        data = json.load(urllib.request.urlopen(request))
    except urllib.error.HTTPError as error:
        # Cloudflare's errors are JSON; a proxy or an outage can answer with an HTML page.
        body = error.read()
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            die(f"{method} {path}: HTTP {error.code} {body[:300].decode(errors='replace')}")
    except urllib.error.URLError as error:
        die(f"{method} {path}: Cloudflare unreachable ({error.reason})")
    auth_failed = any(e.get("code") in (10000, 9109) for e in data.get("errors") or [])
    if auth_failed and not retried and not os.environ.get("CLOUDFLARE_API_TOKEN"):
        refresh_login()
        return api(method, path, body, retried=True)
    return data


def account_id():
    if os.environ.get("CLOUDFLARE_ACCOUNT_ID"):
        return os.environ["CLOUDFLARE_ACCOUNT_ID"]
    accounts = api("GET", "/accounts").get("result") or []
    if len(accounts) != 1:
        names = ", ".join(f"{a['name']} ({a['id']})" for a in accounts) or "none"
        die(f"Set CLOUDFLARE_ACCOUNT_ID; the login sees these accounts: {names}")
    return accounts[0]["id"]


def errors(data):
    return "; ".join(f"{e.get('code')}: {e.get('message')}" for e in data.get("errors") or [])


def create(project):
    path = f"/accounts/{account_id()}/pages/projects"
    existing = api("GET", f"{path}/{project}")
    if existing.get("success"):
        print(f"exists: https://{existing['result']['subdomain']}")
        return
    data = api("POST", path, {"name": project, "production_branch": "main"})
    if not data.get("success"):
        die(f"create failed: {errors(data)}")
    print(f"created: https://{data['result']['subdomain']}")


def deploy(project, site_dir):
    # From inside the folder: wrangler resolves functions/ and its config from the cwd.
    site_dir = os.path.abspath(site_dir)
    if not os.path.isfile(os.path.join(site_dir, "index.html")):
        die(f"no index.html in {site_dir}")
    result = subprocess.run(
        WRANGLER + ["pages", "deploy", ".", f"--project-name={project}", "--branch=main"],
        cwd=site_dir, capture_output=True, text=True,
    )
    # Wrangler leaves a cache in the deployed folder on every run; it is never part of the site.
    shutil.rmtree(os.path.join(site_dir, ".wrangler"), ignore_errors=True)
    output = result.stdout + result.stderr
    for line in output.splitlines():
        if re.search(r"Uploaded|Deployment complete|ERROR|does not exist", line):
            print(re.sub(r"\x1b\[[0-9;]*m", "", line).strip())
    if result.returncode != 0:
        sys.exit(result.returncode)


def domain(project, hostname):
    data = api("POST", f"/accounts/{account_id()}/pages/projects/{project}/domains", {"name": hostname})
    if not data.get("success") and "already" not in errors(data).lower():
        die(f"domain failed: {errors(data)}")
    status(project)


def status(project):
    account = account_id()
    data = api("GET", f"/accounts/{account}/pages/projects/{project}/domains")
    if not data.get("success"):
        die(f"status failed: {errors(data)}")
    target = None
    for d in data["result"]:
        problem = (d.get("verification_data") or {}).get("error_message") or ""
        print(f"{d['name']}\t{d['status']}\t{problem}")
        if d["status"] != "active":
            # Unanswered for days, a pending domain turns "deactivated": add the record, then
            # run `domain` again.
            if target is None:
                # The project's own pages.dev name: <project>.pages.dev unless that was taken,
                # then Cloudflare added a suffix.
                found = api("GET", f"/accounts/{account}/pages/projects/{project}")
                if not found.get("success"):
                    die(f"status failed: {errors(found)}")
                target = found["result"]["subdomain"]
            label = d["name"].split(".")[0]
            print(f"  -> needs DNS record: CNAME {label} -> {target} (proxied)")


def verify(base_url, email=None):
    base_url = base_url.rstrip("/")
    ok = True
    for path in ["/", "/privacy-policy", "/icon.png"]:
        try:
            response = urllib.request.urlopen(
                urllib.request.Request(base_url + path, headers=BROWSER_UA), timeout=15)
            body, code = response.read(), response.status
        except urllib.error.HTTPError as error:
            body, code = b"", error.code
        except urllib.error.URLError as error:
            body, code = b"", f"unreachable ({error.reason})"
        line = f"{path}\t{code}"
        if email and path != "/icon.png":
            found = email.encode() in body
            line += f"\temail {'present' if found else 'MISSING'}"
            ok = ok and found
        ok = ok and code == 200
        print(line)
    sys.exit(0 if ok else 1)


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("create", help="classic Pages project").add_argument("project")
    command = commands.add_parser("deploy", help="wrangler pages deploy, from inside the folder")
    command.add_argument("project")
    command.add_argument("site_dir")
    command = commands.add_parser("domain", help="attach a custom domain")
    command.add_argument("project")
    command.add_argument("hostname")
    commands.add_parser("status", help="the project's domains and their status").add_argument(
        "project")
    command = commands.add_parser("verify", help="GET /, /privacy-policy, /icon.png")
    command.add_argument("base_url")
    command.add_argument("--email", metavar="ADDRESS", help="must be on both pages")
    args = parser.parse_args(argv)
    if args.command == "create":
        create(args.project)
    elif args.command == "deploy":
        deploy(args.project, args.site_dir)
    elif args.command == "domain":
        domain(args.project, args.hostname)
    elif args.command == "status":
        status(args.project)
    else:
        verify(args.base_url, args.email)


if __name__ == "__main__":
    main(sys.argv[1:])
