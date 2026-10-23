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
WRANGLER_CONFIG = os.path.expanduser("~/.config/.wrangler/config/default.toml")
# pages.dev answers 403 to urllib's default User-Agent; a browser one gets the real page.
BROWSER_UA = {"User-Agent": "Mozilla/5.0"}


def die(message):
    print(message, file=sys.stderr)
    sys.exit(1)


def token():
    if os.environ.get("CLOUDFLARE_API_TOKEN"):
        return os.environ["CLOUDFLARE_API_TOKEN"]
    try:
        match = re.search(r'^oauth_token = "([^"]+)"', open(WRANGLER_CONFIG).read(), re.M)
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
        data = json.load(error)
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
    data = api("GET", f"/accounts/{account_id()}/pages/projects/{project}/domains")
    if not data.get("success"):
        die(f"status failed: {errors(data)}")
    for d in data["result"]:
        problem = (d.get("verification_data") or {}).get("error_message") or ""
        print(f"{d['name']}\t{d['status']}\t{problem}")
        if d["status"] != "active":
            # Unanswered for days, a pending domain turns "deactivated": add the record, then
            # run `domain` again.
            label = d["name"].split(".")[0]
            print(f"  -> needs DNS record: CNAME {label} -> {project}.pages.dev (proxied)")


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
    if len(argv) >= 2 and argv[0] == "create":
        create(argv[1])
    elif len(argv) >= 3 and argv[0] == "deploy":
        deploy(argv[1], argv[2])
    elif len(argv) >= 3 and argv[0] == "domain":
        domain(argv[1], argv[2])
    elif len(argv) >= 2 and argv[0] == "status":
        status(argv[1])
    elif len(argv) >= 2 and argv[0] == "verify":
        email = argv[argv.index("--email") + 1] if "--email" in argv else None
        verify(argv[1], email)
    else:
        die(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
