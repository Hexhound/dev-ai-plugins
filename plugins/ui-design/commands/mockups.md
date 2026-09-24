---
description: Design app screens in reviewed rounds with Claude Design or Open Design — greyscale wireframe first, then the look with animated moments, then other sizes.
argument-hint: [area or screens to design]
---

Invoke the **designing-ui-in-rounds** skill and drive it as a guided flow.

1. Confirm the area to design (use `$ARGUMENTS` if given; otherwise ask), the
   design tool (Claude Design or Open Design), and the main screen size.
2. Find where the area stands in `docs/design/`: nothing yet, wireframe in
   progress, wireframe locked, look in progress. Resume from there.
3. Ground the round: read the app's strings file and the backend rules for
   the area.
4. Write the next brief or revision, give the user its path, and stop until
   they return the export (a zip path for Claude Design, or "done" for Open
   Design).
5. Review the export as the skill's `reviewing-exports.md` describes, then
   write the revision or declare the round locked, and record the decisions.

Area: $ARGUMENTS
