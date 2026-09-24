---
description: Port locked mockups (Claude Design export or Open Design project) into the real app — tokens, components, screens, motion — checking each layer against the mockup render.
argument-hint: [area to port, or path to the export/project]
---

Invoke the **porting-mockups-to-code** skill.

1. Confirm what to port and where the mockup source is (use `$ARGUMENTS` if
   given): an unzipped Claude Design export or an Open Design project folder.
2. Check that the area's wireframe and look are locked in `docs/design/`, and
   that the backend supports every state its frames show. Report any gaps.
3. Write or update `docs/design/port-map.md`, then propose the slices (tokens,
   components, screens, motion) and stop for approval.
4. Build each slice with the project's feature workflow (test-first, verify
   gate, fresh-context review), comparing each render with the mockup still.

Target: $ARGUMENTS
