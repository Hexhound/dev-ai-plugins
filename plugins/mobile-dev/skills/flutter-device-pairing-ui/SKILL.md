---
name: flutter-device-pairing-ui
description: Use when building the screens for multi-device sync in a Flutter app — pairing two devices with codes or QR, a device list with honest presence (never a fake "online" dot), the sync status hero and its states, removing a device, vault storage and maintenance. Covers the security handling a bearer-secret invite demands, the widget-test traps (fake clock, sheets under the bottom nav), and the copy decisions worth not re-litigating.
---

# Device pairing & the sync screens

The user-facing half of multi-device sync: getting a second device onto the vault, and
then showing honestly what is and is not known about it. Pairs with
`flutter-multi-device-sync` (the data layer underneath) and
`flutter-scope-dependency-injection` (how the service reaches the widget tree).

Most of what follows is not layout — it is the set of places where the *honest* UI and
the obvious UI differ, and the tests that keep the honest one from regressing.

## Contents

1. Where sync lives in the app
2. The status hero — enumerate the states
3. Presence: what you may honestly claim
4. The device list
5. Pairing: why two codes, and what each carries
6. The invite is a bearer secret — treat it like one
7. QR as an addition, never a replacement
8. Removing a device
9. Storage and maintenance
10. Turning it off
11. Testing the UI (the traps)
12. Copy decisions worth keeping

## 1. Where sync lives

A row in Settings → a dedicated Devices screen. Not a tab, not onboarding. Sync is a
thing a user sets up once and then wants to forget; putting it in the primary navigation
implies ongoing attention it does not need.

Render "off" as an **ordinary state**, not as a missing feature or an error. Most users
will never turn it on and should not feel they are failing to.

## 2. The status hero — enumerate the states

Write the state table down before writing the widget. Six is typical:

| status | colour | title | subtitle |
|---|---|---|---|
| `off` | neutral | Not syncing | Your records stay on this phone only. |
| `starting` | accent | Starting… | last-synced line |
| `syncing` | accent | Syncing… | last-synced line |
| `idle` | success | Up to date | Last synced {rel} · or *Not synced yet* |
| `offline` | **warning, not danger** | Can't reach the server | Your changes are saved and will sync when you're back online. |
| `failed` | danger | Sync problem | the error text |

**`offline` must not be red.** In an offline-first app, being offline is the designed-for
case, not a fault: nothing is lost, nothing needs the user's attention, and the writes are
already durable locally. Red trains people to believe their data is at risk when it is
not — and then to ignore red when it finally means something. This is the single most
important colour decision on the screen.

`failed` is different and *is* red: something is actually broken and the error text is
worth showing.

## 3. Presence: what you may honestly claim

**There is no "online" dot, and there cannot be one.** Sync through a relay is
store-and-forward over ciphertext: a device uploads and leaves. There is no session, no
connection and no heartbeat between devices, so nothing in the system can observe whether
another handset is awake. A green dot would be an invention.

What *is* knowable: when a device last completed a sync, because it says so itself in a
record that then travels. "Last synced 20 minutes ago" is true; "online" is not.

Say this to the designer as a constraint to design *against*, not a limitation to route
around. It is the same class of decision as §2.

Self-reported timestamps come from **that device's clock**. Good enough to render "2 hours
ago"; not good enough to order events by.

## 4. The device list

Back it with a small container each device writes **one key of — its own**. Do not try to
read labels out of the membership roster: a roster entry is a statement about privilege,
deliberately not about liveness, and a self-asserted name there only reaches devices that
have folded that peer's log, so it appears unpredictably.

Last-writer-wins on a key only its owner writes is not conflict resolution at all — it is
a mailbox, which is what makes it safe next to the whole-row LWW everything else uses.

- **The roster is the spine.** A record for a peer that is not in the roster is ignored:
  something that cannot write is not a device on this vault, whatever it claims.
- **Throttle the announcement** (~15 min). Every announcement is an op in a log every
  device downloads forever; one per cycle grows the vault without bound to maintain a
  timestamp nobody reads at that resolution. Publish immediately on rename, though.
- **Announce only after a cycle actually reached the relay.** Announcing a sync that did
  not happen makes the timestamp a lie on every device that reads it.
- **A malformed record is one device's problem.** Catch and render it as un-announced;
  never fail the whole list.
- Sort: this device, then most-recently-synced, then never-heard-from.

Four row states, genuinely different because the user acts differently on each:

| state | subtitle | tap |
|---|---|---|
| this device | *This device · {app version}* | rename |
| synced at some point | *Last synced {when}* | offer to remove |
| paired, never synced | *Paired, hasn't synced yet* | offer to remove |
| revoked | *Removed — no longer syncing* | nothing |

"Paired, hasn't synced yet" is normal for a few seconds after pairing. **Do not style it
as an error.**

**A revoked device stays in the list.** It still holds everything it synced before losing
access; removing the row would tell the user something false about where their data is.

Put the app version on **this device's row only** — every other row's subtitle is carrying
liveness, which is what a person is actually scanning for, and "which version am I on" is
a question about the handset in your hand. Drop it rather than rendering "unknown".

## 5. Pairing: why two codes

Pairing is **symmetric**: each device holds its own store and vouches for the other by
adding its peer id and verifying key to a roster. A device rejects ops authored by an
identity it has never seen — the same check that stops a stranger who guesses a bucket id
from writing into the vault. So identity must travel **both** ways.

```
Device A (has the data)              Device B (wants it)
─────────────────────────            ─────────────────────────
Add a device
  → shows INVITE  ──────────────────→  paste it
                                       ← writes key, opens vault, vouches for A
  paste it   ←────────────────────── shows REPLY
  → vouches for B, syncs
```

- **Invite** — vault key, relay URL, inviter's identity.
- **Reply** — the joiner's identity only. It already has everything else, and a verifying
  key is public by definition, so the reply carries **no secret**. Only the invite needs
  careful handling.

One code cannot do this. The inviter would have to accept ops from a device it has never
heard of.

**Check whether trust transits your relay.** If roster and key logs are republished in each
device's bundle, a third device pairs with *any one* existing device and is trusted by all
— one pairing per new device. If they are not, every device must pair with every other
(three pairings for three devices, six for four) and *the failure is silent*: rows from the
unvouched device simply never arrive. This changes the flow's copy completely, so verify it
against a characterization test rather than assuming.

## 6. The invite is a bearer secret

If the invite contains the raw vault key, then anything that reads it can read and write
everything the user has, forever, with **no revocation** — the key names the bucket, so
changing it means re-uploading everything.

The UI must treat it as what it is:

- A visible warning banner, in danger colour, saying what the code grants.
- **No share sheet.** Copy-to-clipboard only. A share sheet invites forwarding it through
  a channel that keeps a copy.
- Never pre-filled, never logged, never in an analytics event or a crash report.
- Shown deliberately — behind a tap, not on screen the moment the sheet opens.

Write down that this is mitigation, not a fix. If the library offers a PAKE-authenticated
flow (a short code authenticating a channel, with the key crossing it wrapped), landing that
deletes the banner and replaces this whole section with six digits. Track it as a real item
rather than letting the warning banner become permanent furniture.

## 7. QR as an addition, never a replacement

Show a QR **and** keep the typed path. Cameras fail, permissions get denied, and one of the
two devices may be the one with the broken camera.

- Scanning is the *joiner* reading the *inviter's* screen, then the reverse for the reply.
- Handle the permission-denied and no-camera cases as ordinary states with the typed
  fallback right there, not as errors.
- The camera leg is the one thing here that automated tests cannot cover — one device's
  camera reading another's screen is a manual check. Say so in the test plan rather than
  pretending coverage.

## 8. Removing a device

A confirm dialog, and **both halves of the truth**. The second is the one people get wrong:

> Removing it stops it seeing anything new. It keeps every record it already synced —
> nothing can reach back into its storage.

Only offer removal on devices that are not this one and are still active. Renaming applies
to this device only: a device's label is its own to set, which is why there is no rename
action on anyone else's row.

## 9. Storage and maintenance

Users of a health/journal app do ask where the space went. Show the vault's size split
(op log vs. blobs), and offer compaction with a **dry run first** — "this would reclaim
X MB" before anything is deleted.

Two traps:
- Local compaction/checkpointing can fight relay reconciliation. Do not offer it for a
  vault that syncs through a backend until the interaction is tested.
- Icon names are a real defect source here. If your icon set asserts on unknown names in
  debug and silently draws nothing in release, a name typo ships as an invisible glyph.
  Audit every icon string in the feature against the actual set.

## 10. Turning it off

A dialog with **two distinct exits**, because they are genuinely different operations:

- **Stop syncing on this device** — keeps the local data, leaves the vault intact.
- **Stop and delete the local vault copy** — reclaims the space.

Neither removes anything from the other devices, and the copy should say so.

## 11. Testing the UI (the traps)

**`testWidgets` runs a fake clock.** Real sqflite and vault work only advances inside
`tester.runAsync`. Two consequences:

- `pumpAndSettle` never settles against an indeterminate spinner. Interleave instead:

```dart
Future<void> settle(WidgetTester tester) async {
  for (var round = 0; round < 6; round++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
    for (var frame = 0; frame < 6; frame++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }
}
```

- Service calls made *from the test body* need `await tester.runAsync(() => service.invite())`.
- A service with a periodic timer must be stopped **inside the test body**, or the test
  fails on a pending timer.

**Sheets pushed on a nested navigator render under the shell's bottom nav bar — and the
bar swallows the taps.** If your shell paints navigation in a `Stack` above a nested
`Navigator`, any sheet opened from a screen (rather than through the shell's own modal
helper) must pass `useRootNavigator: true`. Guard the whole class behaviourally rather than
fixing call sites one at a time:

```dart
// Rebuild the shell layering, open the sheet, tap where the nav bar sits,
// and assert the nav bar did NOT receive it.
await tester.tapAt(tester.getCenter(find.descendant(
  of: find.byType(MhcBottomNav), matching: find.text('Settings'))));
expect(reachedTheNavBar, isNull);
```

Include a **control** case using the default `useRootNavigator` that asserts the tap *does*
reach the bar — otherwise the guard passes vacuously. Verify by reverting the fix: the
control should still pass while the others fail.

**Pull pure logic out of private widgets.** A subtitle builder as a top-level function takes
`(DeviceInfo, AppLocalizations)` and is testable with
`await AppLocalizations.delegate.load(const Locale('en'))` — no widget, no vault, no service.

**Write one real-vault pairing test** against a live relay. Fakes cannot catch a bridge or
roster bug, and those are exactly the ones that make a shipped build unusable.

## 12. Copy decisions worth keeping

- **"Devices"**, not "Sync", as the screen name — the screen is mostly *about* devices, and
  the settings row already says "Sync across devices".
- **Specific error copy.** "That code is for a different app version" and "That code has
  already been used" are actionable; "Pairing failed" is not.
- **The empty state answers the three questions a user actually has**: is it private, does
  it need signal, can I undo it.
- **Do not put a sync indicator on every screen.** An offline-first app that constantly
  reminds you it is offline is annoying and slightly dishonest.
- **Localize as you go.** Retro-fitting strings across a dozen locales after the fact is
  strictly more work than writing them into the ARB from the start.
