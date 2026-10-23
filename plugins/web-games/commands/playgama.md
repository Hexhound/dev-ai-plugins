---
description: Fill Playgama's "Add Game" form field by field — every value ready (checked against its rule), the three covers rendered at their exact sizes, the extra screenshots, the in-app product — or do it all remotely through the Playgama MCP server.
argument-hint: [game project directory or the form section to fill]
---

Invoke the **playgama-console** skill for the game at `$ARGUMENTS` (or the current project).

First check whether the `playgama-developer-console` MCP tools are connected. If they are,
offer to do the work through them; if they need authentication, tell the user to run `/mcp`
and authenticate (there is no API key). Explore the project first: the title, the build zip,
product ids in the billing code, what the web build does (ads, purchases, controls), and the
store art and texts. Then give a field-by-field table for the form section the user is on, or
for the whole form when no section is named. Render the three covers, pick the extra
screenshots, and save it all in the project.

Game / section: $ARGUMENTS
