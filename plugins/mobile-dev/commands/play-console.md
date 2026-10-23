---
description: Fill Google Play Console forms field by field — every value ready to copy (checked against its limit), the files to upload, and a researched price recommendation.
argument-hint: [app project directory or the Console screen to fill]
---

Invoke the **play-console-setup** skill for the app at `$ARGUMENTS` (or the current project).

When this is a release, first ask whether to generate a promo video (the skill's first
question; a new one, a re-shoot of the existing one, or not now). Explore the project first
(package name, version, product IDs in the billing code, store art and listing drafts), then give a field-by-field table for the Console screen the user is on
— or, with no screen named, for every form still needed to publish, in release order. When a
price is needed, run the skill's price research and recommend one, with sources.

App / screen: $ARGUMENTS
