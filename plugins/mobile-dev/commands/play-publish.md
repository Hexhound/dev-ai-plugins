---
description: Release an Android app to Google Play's internal and closed testing tracks — version bump, changelog and "What's new", signed AAB, upload through the Play Developer API with a service account (dry run first). Promoting further stays the developer's.
argument-hint: [app project directory] [version bump: patch|minor|x.y.z]
---

Invoke the **play-publish** skill for the app at `$ARGUMENTS` (or the current project).

If no service account key is set up yet (`play_publish.py tracks` says so), give the developer
the skill's step-by-step key instructions and stop there. Otherwise:
1. Bump the version.
2. Write the changelog and the "What's new" text.
3. Run the tests and build the signed AAB.
4. Dry-run the upload to `internal` and the app's closed track, then publish it.
5. Report the version code and tracks.

Never promote to open testing or production.

App / bump: $ARGUMENTS
