---
name: play-publish
description: Use when publishing an Android app or game to Google Play's internal and closed testing tracks from the command line — a version bump, a changelog and "What's new" texts, a signed AAB, then an upload through the Google Play Developer API with a service account (no Console clicking). Also covers making that service account key. Engine-agnostic (Godot, Flutter, native). Promoting to open testing or production stays the developer's own step.
user-invocable: true
---

# Publish to Google Play testing tracks

The developer's rule: **every release goes to internal testing and to their closed test.**
Promoting further (open testing, production) is theirs to do in the Console; never do it here.

## First time on a machine: the service account key

There's no Play "token" to copy. Access is a **service account** with a JSON key. Give the
developer these steps (Google's current flow; linking a Cloud project in Play Console's
"API access" page is no longer needed):

1. **Google Cloud project:** https://console.cloud.google.com/projectcreate. Any name, e.g.
   `hexhound-play-publisher`; one project serves every app.
2. **Enable the API:**
   https://console.cloud.google.com/apis/api/androidpublisher.googleapis.com → **Enable**
   (with that project selected).
3. **Service account:** https://console.cloud.google.com/iam-admin/serviceaccounts → **Create
   service account**. Name `play-publisher`. Skip the optional role steps, then **Done**.
   Copy its email (`play-publisher@<project>.iam.gserviceaccount.com`).
4. **Its key:** open the service account → **Keys** → **Add key** → **Create new key** →
   **JSON**. A file downloads. That file is the secret: anyone holding it can publish your
   apps.
5. **Into Play Console:** https://play.google.com/console/users-and-permissions → **Invite
   new users** → paste the service account email.
   - **App permissions:** add the app (or each app) with **Release apps to testing tracks**
     (and **View app information**, ticked with it).
   - No account-wide permissions, nothing financial, no production releases.
   - **Invite user.**
6. **Put the key where the script finds it**, outside every repo:

   ```sh
   mkdir -p ~/.config/play-publisher
   mv ~/Downloads/<project>-*.json ~/.config/play-publisher/service-account.json
   chmod 600 ~/.config/play-publisher/service-account.json
   ```

   Or point `$PLAY_SERVICE_ACCOUNT_JSON` at it.
7. **Check it:**

   ```sh
   python3 <this skill>/scripts/play_publish.py tracks --package <package>
   ```

   It lists every track and what it holds. A 401/403 right after inviting is normal; access
   can take a few minutes to arrive.

Never print, copy into a repo, paste into a chat, or upload the key anywhere. If it leaks:
delete the key in Cloud Console (Keys tab) and make a new one.

## Every release

1. **Find the project's release setup:**
   - the package name;
   - where the version lives (both the version name and the version code);
   - the signing and build script;
   - the release notes folder and the changelog.

   Read the project's store README first.
2. **Bump the version.**
   - +0.1.0 for features, +0.0.1 for fixes, unless the developer says otherwise.
   - The version code must go up by at least 1, in every place it's written.
3. **Write the changelog entry** (`CHANGELOG.md`) and the **"What's new"** text,
   `<notes-dir>/<version>.<language>.txt`.
   - "What's new": 500 characters at most per language, player-facing, a few short bullets,
     only what changed since the last release on Play.
   - Count every text with code.
4. **Run the tests and build the signed AAB** with the project's own script. Keystore
   passwords come from the environment, never printed.
5. **Find the closed track's id** with `tracks`, the first time. The default closed track is
   `alpha`; a custom closed track has its own id. Save it in the project's store README.
6. **Dry run, ask, then publish:**

   ```sh
   python3 <this skill>/scripts/play_publish.py upload --package <package> \
       --aab <bundle.aab> --version <x.y.z> --notes-dir <notes-dir> \
       --tracks internal,<closed-track> [--mapping <mapping.txt>] --dry-run
   ```

   Show the developer what the real run will publish: the package, the version code the dry
   run printed, the version name, the tracks, and every language's "What's new" text. **Wait for
   an explicit yes.** Publishing can't be undone: testers get the release (a closed track after
   Play's review) and the version code is used up for good.

   Then run the same command without `--dry-run`. One edit uploads the bundle once and puts
   that release on both tracks, rolled out in full to their testers, with the notes.

   - **`--mapping`:** R8's `mapping.txt` for this bundle, uploaded in the same edit as its
     deobfuscation file, so Play can read crash and ANR reports from the renamed code. Pass it
     whenever the app is built with R8 on.
7. **Report:**
   - the version code;
   - which tracks got the release;
   - that internal testers get it within minutes;
   - that the closed track goes through Play's review first (hours to a few days).

   Then **commit the release** (version bump, changelog, notes) only if the developer asks.

## When it fails

- **403 "Google Play Android Developer API has not been used in project … or it is
  disabled":** step 2 was skipped. The error has the enable link with the right project; open it
  and click Enable.
- **403 "The caller does not have permission":** the service account isn't invited for this
  app, or lacks "Release apps to testing tracks", or the invite is too new. New Play access can
  take 24–36 hours to start working.
  - Workaround that often makes it work at once: in Play Console, open the app → Monetize →
    Products → In-app products (or Subscriptions), change any product's description and save.
    Revert it afterwards.
- **"APK specifies a version code that has already been used":** bump the version code; Play
  never takes the same code twice. First check with `tracks` that the last run didn't publish
  this very build.
- **A 5xx or a timeout:** nothing is published before the commit, and the script never retries
  an upload or the commit. When the commit itself gets no clear answer, the script reads the
  tracks and says whether the release went through; if it didn't, run the same command again
  with the same version code.
- **"Only releases with status draft may be created on draft app":** the app was never
  published on any track. The first release has to go out from the Console.
- **A track missing:** `tracks` shows the ids this app really has; closed tracks made in the
  Console have custom ids.
- **Upload timeouts on big bundles:** retry. The script waits up to 15 minutes for the upload.
- **Play Console: "Your app is not optimized" (code optimization):** the bundle was built without
  R8. Play reads the compiler's marker in the app's code (D8 = not optimized). Turn on
  `minifyEnabled` in the release build type, with keep rules for anything called by name or
  reflection (JNI, plugins). Then publish with `--mapping`.
  - Godot builds have no export option for it, and `--install-android-build-template` unpacks a
    fresh template every build. Patch the template from an `EditorExportPlugin`'s
    `_export_begin`, which runs after the install and before Gradle. Keep
    `org.godotengine.**` whole: the engine calls it over JNI and finds plugins by reflection.
