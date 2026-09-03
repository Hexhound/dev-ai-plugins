# Flutter Guidelines (provider-neutral source)

This is the canonical, tool-agnostic version of the Flutter conventions. Plain markdown
with no Claude-specific frontmatter, so it can be reused by other AI tooling (e.g. an
OpenAI/Codex adapter that emits `AGENTS.md`) or read by humans.

Claude plugin skills (`plugins/mobile-dev/skills/*/SKILL.md`) are the packaged,
Claude-Code-facing view of this knowledge. Keep the substance here; keep the packaging
thin.

## Project layout
- Feature-first: `lib/features/<feature>/{data,domain,presentation}/`.
- Shared code in `lib/core/` (theme, routing, networking, errors).
- One widget per file; `snake_case` filenames matching the primary class.

## State management
- One explicit approach app-wide; never mix paradigms.
- Business logic out of widgets — widgets render state and dispatch intents only.

## Code conventions
- `dart format` is the formatting source of truth.
- Prefer `const` constructors.
- No `print` in committed code — use a logger.
- Handle every `Future`; no silent unawaited async.
- Null-safety strict; avoid `!` unless the invariant is proven and commented.

## Localization
- Every user-visible string goes through `gen-l10n`; the English ARB is the template and no
  locale ships a missing key.
- **A regional variant needs every key of its own.** `app_pt_PT.arb` falling back to `app_pt.arb`
  is silent — a Portugal user is shown Brazilian text and nothing warns anyone. Same for `zh_TW`
  against `zh`.
- **Never key a locale bundle by language code** once a regional variant exists. `pt` and `pt_PT`
  collapse onto the same entry and one silently overwrites the other; key on the full BCP-47 tag
  (`toLanguageTag()`) and fall back to the base code only if the full tag is absent. This bites
  hardest outside Flutter's own delegate — exported HTML, share viewers, server-rendered strings.
- Dialects are not decoration: pick one variant per file and hold the register throughout
  (pt-BR *celular/você/arquivo* vs pt-PT *telemóvel/si/ficheiro*). Half-translated files read as
  machine output.
- Translate the *text*, never the ICU structure — placeholder names, `plural`, `=1`, `other` stay
  verbatim, and a literal `"` inside an ARB value must be escaped.

## Definition of done
- `flutter analyze` clean.
- `dart format --set-exit-if-changed .` passes.
- Relevant tests pass.
