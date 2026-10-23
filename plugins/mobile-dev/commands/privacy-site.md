---
description: Build and publish an app's privacy policy site on Cloudflare Pages — <app-name>.pages.dev, contact <app_name>@hexhound.dev, home page + policy checked against the code.
argument-hint: [app project directory or existing privacy-policy.html]
---

Invoke the **store-privacy-site** skill for the app at `$ARGUMENTS` (or the current project).

Derive the project name and the `<app_name>@hexhound.dev` email from the app's name, check
the policy against the code (permissions, SDKs, saved data, backup), build the site folder,
then create, deploy and verify it with the skill's `scripts/pages.py`, and put the live URLs
into the app's store docs.

App: $ARGUMENTS
