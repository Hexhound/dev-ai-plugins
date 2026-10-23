#!/usr/bin/env python3
"""Publishes an Android App Bundle to Google Play testing tracks through the Google Play Developer
API (androidpublisher v3), as a service account. Only `requests` and `cryptography` are needed.

    play_publish.py tracks  --package com.example.app
    play_publish.py upload  --package com.example.app --aab app.aab --tracks internal,alpha \
                            --notes-dir release_notes --version 1.2.0 \
                            [--mapping mapping.txt] [--dry-run]

The key: --key <service-account.json>, else $PLAY_SERVICE_ACCOUNT_JSON, else
~/.config/play-publisher/service-account.json. It is a secret: kept outside every repo, mode
600; nothing here prints it or the access token.

`tracks` lists the app's tracks and what each one holds (read-only; it opens an edit and throws
it away). `upload` opens one edit, uploads the bundle once, puts it on every track given (each
track's release becomes this one, rolled out to that track's testers in full), with its "What's
new" texts, then commits. Play reviews a closed-track release before testers get it. With
--dry-run it validates the edit and throws it away instead of committing.

Release notes: <notes-dir>/<version>.<language>.txt, e.g. 1.2.0.en-US.txt (500 characters at
most each); every language found is sent.

--mapping: R8's mapping.txt for this bundle (an app built with R8 on, which is what Play Console's
"code optimization" asks for). It goes up in the same edit, as the bundle's deobfuscation file, so
Play can read the crash and ANR reports of the renamed code.
"""
import argparse
import base64
import json
import os
import stat
import sys
import time
from pathlib import Path

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"
UPLOAD = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications"
SCOPE = "https://www.googleapis.com/auth/androidpublisher"
DEFAULT_KEY = Path.home() / ".config/play-publisher/service-account.json"
NOTES_LIMIT = 500


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    sys.exit(1)


def load_key(path: str | None) -> dict:
    key_path = Path(path or os.environ.get("PLAY_SERVICE_ACCOUNT_JSON") or DEFAULT_KEY).expanduser()
    if not key_path.is_file():
        fail(f"no service account key at {key_path} (see the play-publish skill: how to make one)")
    mode = key_path.stat().st_mode
    if mode & (stat.S_IRWXG | stat.S_IRWXO):
        print(f"warning: {key_path} is readable by others; run: chmod 600 {key_path}",
              file=sys.stderr)
    key = json.loads(key_path.read_text())
    if key.get("type") != "service_account":
        fail(f"{key_path} is not a service account key (type={key.get('type')!r})")
    return key


def access_token(key: dict) -> str:
    """A service account's OAuth token: a signed JWT exchanged at Google's token endpoint."""
    now = int(time.time())
    header = {"alg": "RS256", "typ": "JWT", "kid": key["private_key_id"]}
    claims = {"iss": key["client_email"], "scope": SCOPE, "aud": key["token_uri"],
              "iat": now, "exp": now + 3600}

    def part(data: dict) -> bytes:
        return base64.urlsafe_b64encode(json.dumps(data, separators=(",", ":")).encode()).rstrip(b"=")

    signing_input = part(header) + b"." + part(claims)
    private_key = serialization.load_pem_private_key(key["private_key"].encode(), password=None)
    signature = private_key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
    assertion = signing_input + b"." + base64.urlsafe_b64encode(signature).rstrip(b"=")
    answer = requests.post(key["token_uri"], data={
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": assertion.decode()}, timeout=30)
    if answer.status_code != 200:
        fail(f"Google refused the key: {answer.status_code} {answer.text[:300]}")
    return answer.json()["access_token"]


class Play:
    def __init__(self, token: str, package: str):
        self.session = requests.Session()
        self.session.headers["Authorization"] = f"Bearer {token}"
        self.package = package

    def call(self, method: str, path: str, **kwargs) -> dict:
        url = f"{kwargs.pop('base', API)}/{self.package}{path}"
        timeout = kwargs.pop("timeout", 120)
        # Google's API answers 500/502/503 now and then: wait and try again (a bundle upload's
        # file is read again from the start).
        for attempt in range(5):
            data = kwargs.get("data")
            if hasattr(data, "seek"):
                data.seek(0)
            answer = self.session.request(method, url, timeout=timeout, **kwargs)
            if answer.status_code not in (500, 502, 503, 504) or attempt == 4:
                break
            wait = 5 * 2 ** attempt
            print(f"    Google answered {answer.status_code}; trying again in {wait} s",
                  file=sys.stderr)
            time.sleep(wait)
        if answer.status_code >= 300:
            hint = ""
            if answer.status_code in (401, 403):
                hint = (" (is the service account invited in Play Console > Users and permissions,"
                        " with release rights for this app?)")
            fail(f"{method} {path}: {answer.status_code} {answer.text[:500]}{hint}")
        return answer.json() if answer.text else {}

    def open_edit(self) -> str:
        return self.call("POST", "/edits")["id"]

    def drop_edit(self, edit: str) -> None:
        self.session.delete(f"{API}/{self.package}/edits/{edit}", timeout=60)


def list_tracks(play: Play) -> None:
    edit = play.open_edit()
    try:
        tracks = play.call("GET", f"/edits/{edit}/tracks").get("tracks", [])
        for track in tracks:
            releases = track.get("releases", [])
            print(f"{track['track']}:")
            if not releases:
                print("    (empty)")
            for release in releases:
                print(f"    {release.get('name', '?')}  codes {release.get('versionCodes', [])}"
                      f"  {release.get('status')}")
    finally:
        play.drop_edit(edit)


def read_notes(notes_dir: str, version: str) -> list[dict]:
    notes = []
    for path in sorted(Path(notes_dir).glob(f"{version}.*.txt")):
        language = path.name[len(version) + 1:-len(".txt")]
        text = path.read_text().strip()
        if len(text) > NOTES_LIMIT:
            fail(f"{path} is {len(text)} characters; Play takes {NOTES_LIMIT} at most")
        notes.append({"language": language, "text": text})
    if not notes:
        fail(f"no release notes {notes_dir}/{version}.<language>.txt")
    return notes


def upload(play: Play, aab: str, tracks: list[str], version: str, notes: list[dict],
           mapping: str | None, dry_run: bool) -> None:
    bundle = Path(aab)
    if not bundle.is_file():
        fail(f"no bundle at {bundle}")
    if mapping and not Path(mapping).is_file():
        fail(f"no mapping file at {mapping}")
    edit = play.open_edit()
    committed = False
    try:
        existing = {t["track"] for t in play.call("GET", f"/edits/{edit}/tracks").get("tracks", [])}
        missing = [t for t in tracks if t not in existing]
        if missing:
            fail(f"no track {missing} on this app; it has: {sorted(existing)}")
        print(f"==> uploading {bundle.name} ({bundle.stat().st_size / 1e6:.1f} MB)")
        with bundle.open("rb") as data:
            uploaded = play.call("POST", f"/edits/{edit}/bundles", base=UPLOAD, timeout=900,
                                 params={"uploadType": "media"}, data=data,
                                 headers={"Content-Type": "application/octet-stream"})
        code = int(uploaded["versionCode"])
        print(f"    versionCode {code}")
        if mapping:
            print(f"==> uploading the R8 mapping {Path(mapping).name}"
                  f" ({Path(mapping).stat().st_size / 1e6:.1f} MB)")
            with Path(mapping).open("rb") as data:
                play.call("POST", f"/edits/{edit}/apks/{code}/deobfuscationFiles/proguard",
                          base=UPLOAD, timeout=300, params={"uploadType": "media"}, data=data,
                          headers={"Content-Type": "application/octet-stream"})
        for track in tracks:
            play.call("PUT", f"/edits/{edit}/tracks/{track}", json={
                "track": track,
                # Named like the Console names its own releases: "4 (1.2.0)".
                "releases": [{"name": f"{code} ({version})", "versionCodes": [str(code)],
                              "status": "completed", "releaseNotes": notes}],
            })
            print(f"==> {track}: {code} ({version}), notes in {[n['language'] for n in notes]}")
        if dry_run:
            play.call("POST", f"/edits/{edit}:validate")
            print("==> dry run: the edit is valid; thrown away, nothing published")
        else:
            play.call("POST", f"/edits/{edit}:commit")
            committed = True
            print("==> committed. Internal testers get it in minutes; a closed track goes"
                  " through Play's review first.")
    finally:
        if not committed:
            play.drop_edit(edit)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("command", choices=["tracks", "upload"])
    parser.add_argument("--package", required=True, help="the app's package name")
    parser.add_argument("--key", help="service account JSON (default: $PLAY_SERVICE_ACCOUNT_JSON)")
    parser.add_argument("--aab", help="the signed bundle to upload")
    parser.add_argument("--tracks", default="internal", help="comma-separated track ids")
    parser.add_argument("--version", help="the release name (version name), e.g. 1.2.0")
    parser.add_argument("--notes-dir", help="folder of <version>.<language>.txt release notes")
    parser.add_argument("--mapping", help="R8's mapping.txt for this bundle (deobfuscation file)")
    parser.add_argument("--dry-run", action="store_true", help="validate, then throw the edit away")
    args = parser.parse_args()
    play = Play(access_token(load_key(args.key)), args.package)
    if args.command == "tracks":
        list_tracks(play)
        return
    if not (args.aab and args.version and args.notes_dir):
        fail("upload needs --aab, --version and --notes-dir")
    tracks = [t.strip() for t in args.tracks.split(",") if t.strip()]
    upload(play, args.aab, tracks, args.version, read_notes(args.notes_dir, args.version),
           args.mapping, args.dry_run)


if __name__ == "__main__":
    main()
