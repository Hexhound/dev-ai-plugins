# Brief shapes

Four shapes cover every round. Keep each under about 400 words. Write in
plain sentences. Put labels in backticks, exactly as the app will show them.

## 1. Wireframe brief

```markdown
# Brief — <App>, <area>, <size>, wireframe only

## What to make
<Two to four sentences: who uses this area, what they do in it, the canvas
size (e.g. 1440×900).>

## Hard rules
Greys only, one weight of line, placeholder blocks for pictures, real labels
exactly as written, nothing not listed.

## Do not add
<Features, controls and decoration the tool tends to invent for this kind
of screen. Be specific: "No search or filters in Library", "No
drag-and-drop area".>

## <Screen or section>
<What sits where, in reading order. Real labels in backticks.>

## Frames
**1. <State name>.** <What differs from the base layout.>
**2. <State name>.** ...
**2b. <Variant>.** ...
```

Frames come from real states: empty, loading or busy, error, not allowed,
signed out, and each role that sees something different (host or guest,
admin or user).

## 2. Revision

```markdown
# Revision 2 — <area>

Keep every frame as it is, except what is listed here.

- **Frame 4.** <What is wrong, and what it should be instead.> <One
  sentence of why when the tool could get it wrong again.>
- **Frame 7b, new.** <A new frame.>
```

List only changes. If revision 3 includes revision 2's changes, say so:
"This includes the changes from revision 2, so skip revision 2 if it has
not been run."

## 3. Look foundation (one board)

```markdown
# Brief — <App> look, round 1

Attach <reference image> with this brief.

## What this app should feel like
<The feeling in plain words, plus one comparison ("the character that
guides you through a party game, not a corporate mascot in a corner").>

## Deliver one board with <n> parts
**1. The mascot sheet.** <Poses, each named after the moment it is for.>
**2. Colour.** <Surfaces, at most eight named swatches, which colour means
"press this".>
**3. Type and pieces.** <Display and body faces (with script needs such as
Japanese), then each key component drawn once with real copy.>

Under the pieces, short notes on motion.

## Do not
<Style bans: neon, glassmorphism, emoji, generic dashboard...>
```

Run it more than once if needed. Record what the user rejects (a palette, a
"retro" look, badges) as bans for every later brief.

## 4. Look per area

```markdown
# <App> look — <area>

The <area> wireframe is locked. Give it the approved look: <palette, fonts,
the emphasis-colour rule>. Same bans: <list>. Keep the wireframe's layout
and copy exactly. One mascot per screen.

<One paragraph: what this area should feel like, and where the fun lives.>

Deliver an animated, self-running HTML prototype of the moment, plus stills.

## The moment: <name> (<n> s)
1. <Beat: what moves, what the mascot does, what the copy says.>
2. ...

## Details
<Rules the look must follow in this area: state marks, monospace paths,
which button is the strong one and when.>

## Stills
- **<Name>**: frame <n>, <what to show>.
- **Dark mode**: frame <n>.
```

Pick the one moment where the area's story happens (a result reveal, a
friend request accepted, a microphone test). Use made-up lyrics and content,
never real copyrighted text.
