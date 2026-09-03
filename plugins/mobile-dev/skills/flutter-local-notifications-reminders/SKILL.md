---
name: flutter-local-notifications-reminders
description: Use when a Flutter app needs scheduled local reminders — exact-time zoned notifications that survive reboot and Doze, DND-proof alerting, self-healing idempotent sync that never wipes the shade, OS-restriction health checks, action buttons handled in a background isolate, cold-start tap routing, a pure testable planner, and staying under the iOS 64-pending limit.
---

# Local notifications & exact reminders

Schedule reminders that fire at a precise instant, survive reboot and Doze, get past Do Not
Disturb, carry action buttons handled without opening the app, and route taps to the right
screen. A **pure planner** computes the set; a scheduler diffs the cancels and re-arms the rest.

Pairs with `flutter-sqlite-ffi-fts5` (the background-isolate DB rule) and
`flutter-home-screen-widgets` (a background action can refresh a widget).

## Contents

1. Dependencies & manifest
2. Init: timezone + channel + categories + callbacks
3. Permissions — and why they are not enough
4. Scheduling one exact alarm
5. Getting past Do Not Disturb
6. Action buttons (Android per-notification vs iOS category)
7. Handling responses: foreground streams, cold start, background isolate
8. The pure planner + **self-healing** sync
9. Budgets and the rolling horizon
10. OS states that silently break delivery — detect and report
11. Catch-up, and why it must be bounded
12. Gotchas
13. Diagnosing a real device

## 1. Dependencies & manifest

```yaml
dependencies:
  flutter_local_notifications: ^22.0.1
  timezone: ^0.11.0
  flutter_timezone: ^5.1.0
```

Android manifest: the plugin's `ScheduledNotificationBootReceiver` (with `BOOT_COMPLETED` **and
`MY_PACKAGE_REPLACED`** — an app update drops alarms just like a reboot), the exact-alarm
permission, and `POST_NOTIFICATIONS`.

`USE_EXACT_ALARM` is **API 33+ and auto-granted**. `SCHEDULE_EXACT_ALARM` covers API 31–32 and is
**user-revocable**. If your `minSdk` is 31 or 32, some of your users are on the revocable one and
your scheduling code must survive it being taken away mid-flight. See §8.

## 2. Init: timezone + channel + categories + callbacks

`zonedSchedule` needs a real local timezone. Initialize once, idempotently:

```dart
Future<void> init({required String channelName, required String channelDescription, ...}) async {
  if (_ready) return;
  tzdata.initializeTimeZones();
  try { tz.setLocalLocation(tz.getLocation((await FlutterTimezone.getLocalTimezone()).identifier)); }
  catch (_) { /* leave tz.local at UTC if the platform can't report a zone */ }

  final darwin = DarwinInitializationSettings(notificationCategories: [
    DarwinNotificationCategory('dose', actions: [                    // iOS actions live in a category
      DarwinNotificationAction.plain(actionTake, takeLabel),
      DarwinNotificationAction.plain(actionSkip, skipLabel),
    ]),
  ]);
  await _plugin.initialize(
    settings: InitializationSettings(android: const AndroidInitializationSettings('@mipmap/ic_launcher'), iOS: darwin),
    onDidReceiveNotificationResponse: _onResponse,                   // foreground
    onDidReceiveBackgroundNotificationResponse: doseActionBackgroundCallback, // background isolate
  );
  await _android?.createNotificationChannel(AndroidNotificationChannel(
      'reminders', channelName, description: channelDescription, importance: Importance.high));
  _ready = true;
}
```

**A channel's behaviour is immutable after creation.** `createNotificationChannel` on an existing
id updates only name/description/group. Deleting and recreating the *same* id does **not** reset
it — Android retains deleted-channel settings for 30 days and un-deletes in place. So importance,
`bypassDnd`, and audio attributes are frozen at first creation, forever, for every existing
install. If you must change one, you need a **new channel id**. Storing the id as a rotatable
value (a UUID in prefs) is cheaper than hardcoding `_v2`, `_v3` … as you discover this.

## 3. Permissions — and why they are not enough

```dart
await _android?.requestNotificationsPermission();     // POST_NOTIFICATIONS (Android 13+)
await _android?.requestExactAlarmsPermission();        // no-op if USE_EXACT_ALARM granted
await _ios?.requestPermissions(alert: true, badge: true, sound: true);
```

Granted permissions do **not** mean your reminders will be delivered. On a real device with every
permission granted, the app not stopped, the channel unblocked, and alarms correctly registered,
reminders can still be silenced (§5) or deferred for hours (§10). Verify delivery, not grants.

## 4. Scheduling one exact alarm

`AndroidScheduleMode.exactAllowWhileIdle` maps to `setExactAndAllowWhileIdle` — fires at the
precise instant in Doze:

```dart
Future<void> schedule({required int id, required String title, required String body,
    required DateTime fireAt, required bool daily, String? payload, bool withActions = false}) =>
  _plugin.zonedSchedule(
    id: id,
    scheduledDate: tz.TZDateTime.from(fireAt, tz.local),
    notificationDetails: _detailsFor(withActions: withActions),
    androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
    title: title, body: body.isEmpty ? null : body, payload: payload,
    matchDateTimeComponents: daily ? DateTimeComponents.time : null,
  );
```

### `AndroidScheduleMode.alarmClock` — stronger, but has real costs

`setAlarmClock` is exempt from background restriction, forced app standby, battery saver, and the
9-minute `allowWhileIdle` rate cap. In AOSP `AlarmManagerService`, `isBackgroundRestricted`,
`isExemptFromAppStandby` and `isExemptFromBatterySaver` all short-circuit on
`alarmClock != null`; `setImplLocked` additionally sets `FLAG_WAKE_FROM_IDLE`. Verified identical
across android12→16-release. It is the only thing that defeats OEM background restriction without
user action.

Do not reach for it reflexively. Two costs:

- **`getNextAlarmClock()` has no permission check.** Your next alarm time and package name are
  readable by every app on the device and painted on the lock screen / AOD. For a health,
  finance, or otherwise sensitive app that is a consent-free disclosure — make it an opt-in.
- **The plugin passes the same PendingIntent as both `showIntent` and `operation`.** SystemUI's
  Quick Settings Alarm tile *sends* `showIntent` on tap, and the terminal call is a generic
  `PendingIntent.send` — so a broadcast PendingIntent gets broadcast. Tapping the alarm tile
  fires your notification early.

#### Re-arm the plugin's own alarm instead of patching the plugin

You do not need a fork or a second scheduler. Let the plugin schedule normally, then **look up
the PendingIntent it created and hand that same one back to `setAlarmClock`** with a show-intent
of your own:

```kotlin
// The plugin uses the notification id as the request code and targets its own receiver, and
// Intent.filterEquals (what PendingIntent matches on) ignores extras — so the same
// (requestCode, component, flags) triple resolves to the plugin's live PendingIntent, carrying
// the notification it already serialised. FLAG_NO_CREATE keeps this a lookup: no pending alarm
// for this id means null, not a new alarm that would fire an empty intent.
val operation = PendingIntent.getBroadcast(
    context, id,
    Intent(context, Class.forName(
        "com.dexterous.flutterlocalnotifications.ScheduledNotificationReceiver")),
    PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE) ?: return false

// Deliberately an activity: this slot gets *sent*, so a broadcast here is the early-fire bug.
val show = PendingIntent.getActivity(
    context, id,
    context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return false,
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

alarmManager.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAtMillis, show), operation)
```

Same operation PendingIntent means AlarmManager **replaces** the plugin's alarm rather than
adding a second one, so the reminder cannot fire twice. Guard with `canScheduleExactAlarms()`
*and* catch `SecurityException` — the grant can be revoked between the check and the call — and
treat every failure as "the plugin's own alarm stands": late beats absent.

**Never promote a repeating reminder.** `matchDateTimeComponents` alarms are re-armed by the
plugin as each one fires; replacing that with a one-shot alarm clock delivers the next occurrence
and then silently stops forever. One-shots only.

## 5. Getting past Do Not Disturb

**This is the single most commonly missed step, and it silently costs you every alert during
DND.** A default channel is `USAGE_NOTIFICATION` with `bypassDnd = false`, so under
`ZEN_MODE_IMPORTANT_INTERRUPTIONS` with `allowChannels=priority` it is intercepted: no sound, no
heads-up, no screen wake. It lands silently in the shade and the user finds it hours later.

AOSP `ZenModeFiltering.isAlarm()` is an **OR**:

```java
isCategory(CATEGORY_ALARM, record) || isAudioAttributesUsage(USAGE_ALARM, record)
```

and that branch is evaluated independently of `canRecordBypassDnd` and Android 15's
priority-channel logic. So:

```dart
AndroidNotificationDetails(channelId, channelName,
  importance: Importance.high,
  category: AndroidNotificationCategory.alarm,   // <- clears DND interception, no permission
  ...)
```

**One line, no channel migration, applies to every existing install.** It also exempts you from
Android 15/16 polite-notification volume attenuation.

Interception is only the first gate. Sound and vibration are gated *again* by an app-ops
restriction keyed on audio **usage** (`ZenModeHelper.applyRestrictions`). Under priority-only DND
the exemption list contains `com.android.systemui`, which plays the sound, so category alone
works. Under **`ZEN_MODE_ALARMS` ("Alarms only") that list is `null`**, so `USAGE_NOTIFICATION`
audio is muted and you get a *silent heads-up*. To be correct there too, the channel also needs
`audioAttributesUsage: AudioAttributesUsage.alarm` — which requires a new channel id, and carries
its own trap:

- `playSound()` gates on `getStreamVolume(STREAM_ALARM) != 0`. **Alarm volume at zero = totally
  silent, with no vibration fallback** (the vibrate-mode demotion requires stream volume == 0,
  which `STREAM_ALARM` is not).
- Conversely a phone set to vibrate will **ring out loud**, and the notification-volume slider
  stops applying.

Decide deliberately. Prefer `bypassDnd` + `ACCESS_NOTIFICATION_POLICY` only as a last resort: it
is strictly weaker (Android 15's `allowPriorityChannels()` can veto it) and costs a special-access
grant users refuse.

Residual gap either way: `ZEN_MODE_NO_INTERRUPTIONS` ("Total silence") blocks alarms too — the
AOSP comment on that branch is literally `// #notevenalarms` — and `policy.allowAlarms()` is
user-switchable. Needing no permission is not the same as cannot be turned off.

## 6. Action buttons (two platform shapes)

Android attaches actions **per notification**; iOS reads them from the **pre-registered
category**. `showsUserInterface: false` handles the tap silently; `cancelNotification: true`
clears it:

```dart
NotificationDetails _detailsFor({required bool withActions}) => NotificationDetails(
  android: AndroidNotificationDetails('reminders', _channelName, importance: Importance.high,
    category: AndroidNotificationCategory.alarm,
    actions: withActions ? [
      AndroidNotificationAction(actionTake, _takeLabel, showsUserInterface: false, cancelNotification: true),
      AndroidNotificationAction(actionSkip, _skipLabel, showsUserInterface: false, cancelNotification: true),
    ] : null),
  iOS: DarwinNotificationDetails(categoryIdentifier: withActions ? 'dose' : null),
);
```

Do **not** set `setOngoing` to make a reminder unmissable — no well-tested calendar or reminder
app does. Schedule a **follow-up re-nag alarm** instead (e.g. at `min(10 min, ¼ of the gap to the
next occurrence)`) that posts only if the item is still unacknowledged.

Take control of grouping. Left alone, the system ranker auto-bundles several notifications into
`ranker_group`, where they collapse and the user sees one collapsed row instead of three
reminders.

## 7. Handling responses: foreground, cold start, background

Three distinct paths:

- **Foreground** — one callback routes by whether an `actionId` is present:
  ```dart
  void _onResponse(NotificationResponse r) {
    if (r.actionId?.isNotEmpty ?? false) _actions.add((actionId: r.actionId!, payload: r.payload));
    else if (r.payload?.isNotEmpty ?? false) _taps.add(r.payload!);
  }
  ```
- **Cold start** — the tap that launched the app:
  ```dart
  Future<String?> launchPayload() async {
    final d = await _plugin.getNotificationAppLaunchDetails();
    return (d?.didNotificationLaunchApp ?? false) ? d!.notificationResponse?.payload : null;
  }
  ```
- **Background isolate** — an action tapped while the app is terminated runs in a **headless
  isolate with no app state**. It must open its **own** DB (FFI factory selected again;
  `singleInstance: false` so closing it can't slam the foreground's shared connection), do the
  work, and close. Annotate `@pragma('vm:entry-point')` for AOT retention:
  ```dart
  @pragma('vm:entry-point')
  Future<void> doseActionBackgroundCallback(NotificationResponse response) async {
    final target = ReminderPayload.decode(response.payload);
    if (response.actionId == null || target == null) return;
    WidgetsFlutterBinding.ensureInitialized();
    initSqliteFfi();                                  // this isolate must select FFI too
    final db = await AppDatabase.open(path: dbPath, singleInstance: false);  // private connection
    try { await applyAction(AppRepositories(db), target, response.actionId!); }
    finally { await db.close(); }
  }
  ```
  Pass the **explicit db path** — a headless isolate that opens pathlessly can silently create or
  read the wrong database.

  **Resolve localized strings from the user's actual locale, not a hardcoded one.** A background
  re-sync that hardcodes `Locale('en')` rewrites every reminder's text in English on every run.
  This is easy to miss because it only shows up for non-English users, days later.

  Keep the write logic (`applyAction`) a plain function shared with the foreground path so a
  notification action and the in-app button produce identical rows.

## 8. The pure planner + **self-healing** sync

Separate **what to schedule** (pure, testable) from **registering it**:

```dart
// pure: data in -> reminders out. No plugin, no db. Unit-tested.
List<PlannedReminder> planReminders({required DateTime now, required List<Event> appts, ...}) { ... }
```

### Diff the cancels, re-schedule unconditionally

```dart
Future<void> syncAll({required DateTime now, required ReminderStrings strings}) async {
  final planned = planReminders(now: now, appts: await repos.events.all(), ...);
  final plannedIds = {for (final r in planned) r.id};

  final pending = await notifications.pendingRequests();  // the PLUGIN's list, not the OS's
  final pendingIds = pending.map((p) => p.id).toSet();

  for (final id in pendingIds.difference(plannedIds)) {
    await notifications.cancel(id);                       // per-id, targeted — never cancelAll
  }
  for (final r in planned) {
    // EVERY planned reminder, every sync — including ones `pending` already lists.
    try {
      await notifications.schedule(id: r.id, ...);
    } catch (e) {
      // Per-reminder: one failure costs that reminder, not the whole set.
    }
  }
}
```

**Diff the cancel side only.** `pendingNotificationRequests()` does not query the OS — it returns
a list the plugin persists in its own `SharedPreferences`
(`shared_prefs/scheduled_notifications.xml`). It drifts from the real `AlarmManager` state and
nothing in the plugin notices. Measured on a Moto G06:

```
plugin store entries : 29
dumpsys alarm entries: 0
```

A user tapping **Force stop** (which Android's own battery screen offers, and OEM battery
managers actively encourage), an OEM task killer, or a boot whose receiver never ran under a
background restriction all clear the app's `PendingIntent`s while leaving that list intact. Skip
the re-schedule for anything "already pending" and those reminders are **silently dead forever**
— nothing about the plugin's own bookkeeping looks wrong.

Re-arming is idempotent: scheduling an existing id replaces the alarm, and does **not** dismiss
an already-displayed notification. So the unconditional re-schedule costs N alarm writes per
sync and buys self-healing. Take that trade — a reminder that never fires is the failure mode
this whole skill exists to prevent.

Verify with the drift scenario, not just a happy-path sync:

```bash
adb shell am force-stop <pkg>        # clears OS alarms, leaves the plugin's list untouched
adb shell am start -n <pkg>/.MainActivity
adb shell dumpsys alarm | grep -c "<pkg>/com.dexterous"   # must return to the full count
```

Diffing the cancel side per-id matters for two reasons that a blanket
`cancelAll()`-then-reschedule cannot satisfy:

- **`cancelAll()` dismisses notifications currently in the shade**, not just pending schedules —
  it maps to `NotificationManager.cancelAll()`. A re-sync runs on app launch, on resume, on
  settings change and from background refresh, so a blanket sweep *deletes the reminder the user
  has not read yet*. Seen in production: three reminders posted and alerted, then destroyed 6.5
  seconds later by the app's own re-sync. The user hears the alert and finds an empty shade.
- **Cancel-then-reschedule is non-atomic with no rollback.** The cancel has already run when the
  reschedule loop starts, and `zonedSchedule` throws `exact_alarms_not_permitted` when the
  exact-alarm permission is absent — user-revocable on `minSdk` 31/32 (§1). One throw mid-loop
  leaves the user with **zero** reminders, silently and permanently, re-attempted on every
  resume. Cancelling only what actually disappeared, and scheduling each reminder in its own
  `try`, means a failure costs one reminder rather than all of them.

Because cancellation is now per-id, make sure you
*do* cancel the ids that should disappear — deleted entities, deactivated schedules, and **the
previous profile's reminders in a multi-profile app**, where `syncAll` only ever sees one
profile's data.

Give each reminder a **stable id** from a semantic key so a re-sync replaces rather than
duplicates:

```dart
int _idFor(String key) { var h = 0x811c9dc5; for (final c in key.codeUnits) { h ^= c; h = (h * 0x01000193) & 0xFFFFFFFF; } return h & 0x7FFFFFFF; }
```

**Coalesce reminders that share a fire instant.** A planner keyed on `(entity, day, slot)` will
happily emit several alarms for the same moment. One notification listing three items is better
UX, and it sidesteps both the rate cap and ranker auto-bundling.

The trap is the **payload**. It is what the action buttons write from, so a merged notification
whose payload names only the first entity logs one and leaves the others looking unanswered.
Make the payload carry a *list* of targets, keep the tap deep-link reading the first, and keep
the old single-target form decoding unchanged — reminders scheduled by the previous build are
still pending in the OS and will fire against the new code. Drop a truncated tail rather than
guessing at it: a half-read id writes against the wrong entity.

## 9. Budgets and the rolling horizon

**iOS caps pending notifications at 64.** Don't schedule an unbounded future:

- Materialize a **rolling horizon** of one-shots (e.g. 14 days) and roll it forward with a
  background re-sync. One-shot-per-day also gives correct per-day content; a single infinite
  repeating alarm outlives the data it describes.
- **Budget the set** and sort by soonest.

**Budget every class of reminder, not just one.** A budget like
`doseBudget = (kMaxTotal - appointments.length).clamp(0, kMaxDose)` looks fine until the
appointments list is itself uncapped — enough of them drives the budget to zero and **silently
drops every dose reminder**. Cap and sort *all* classes, and make exhaustion a user-visible
condition, not a `debugPrint`.

Note the horizon is only as good as the thing that rolls it. If your roll-forward is a background
alarm or job, it is subject to the same OS restrictions as everything else in §10 — on a
restricted device reminders stop entirely once the horizon runs out.

## 10. OS states that silently break delivery — detect and report

Everything can be correct and reminders still not arrive. Expose these via a MethodChannel and
show a health screen. **Re-verify after the user returns from Settings** — "we asked" is not "it
works", and never show a healthy state until the check actually passes.

| State | Detect | Send user to |
|---|---|---|
| Background restricted | `ActivityManager.isBackgroundRestricted()` | `ACTION_APPLICATION_DETAILS_SETTINGS` |
| Battery optimized | `PowerManager.isIgnoringBatteryOptimizations()` | `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` |
| Exact alarms revoked | `AlarmManager.canScheduleExactAlarms()` | `ACTION_REQUEST_SCHEDULE_EXACT_ALARM` |
| Notifications off | `areNotificationsEnabled()` | `ACTION_APP_NOTIFICATION_SETTINGS` |
| Channel (or its **group**) muted | `getNotificationChannel(id).importance != IMPORTANCE_NONE` **and** `getNotificationChannelGroup(channel.group)?.isBlocked != true` | `ACTION_CHANNEL_NOTIFICATION_SETTINGS` |
| DND on now | `getCurrentInterruptionFilter()` | — |
| DND disallows alarms | `getConsolidatedNotificationPolicy()` → `PRIORITY_CATEGORY_ALARMS` | — |
| Alarm volume zero (if using alarm audio) | `AudioManager.getStreamVolume(STREAM_ALARM) == 0` | — |

Four rules that decide whether the health screen is trustworthy:

- **Check the channel *group*, not just the channel.** Muting a group leaves every channel inside
  it still reporting its original importance while nothing is delivered — precisely the silent
  failure the probe exists to catch.
- **Probe the channel you actually post on.** If alert styles map to separate channels (they must,
  since channel behaviour is immutable — §12), only one of them can be the muted one. Reading the
  wrong id tells a user with a muted alarm channel that everything is fine.
- **A missing or unanswerable field defaults to *healthy*.** A `MissingPluginException`, an older
  native side, or iOS must not be able to send the user into Settings over a restriction nobody
  measured. Absent channel counts as enabled too: it is created on the first reminder, so a fresh
  install would otherwise be greeted with a warning about a channel that does not exist yet.
- **Suppress redundant rows.** Do not report a blocked channel when notifications are off
  entirely, or battery optimisation under a full background restriction — each pair is the same
  fact told twice, and a list of five warnings is one the user scrolls past. Show the card *only*
  when something is wrong; a standing "reminders are fine" row is a row nobody reads, and its
  presence is the whole signal.

**Background restriction is the one that will bite you.** An OEM battery manager sets appop
`RUN_ANY_IN_BACKGROUND: ignore`; AlarmManager then holds every alarm in a
`Pending user blocked background alarms` queue and releases the lot when the app next becomes
active — hours late, all at once. `exactAllowWhileIdle` does not help; only `setAlarmClock` (§4)
or the user unrestricting the app does. **No API lets an app lift its own restriction.**

Do **not** request `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`. Google's acceptable-use list is
IM/calling, safety apps, task automation and peripheral companions — alarms are *not* on it, and
the Doze documentation explicitly points alarm apps at `setExactAndAllowWhileIdle` instead. Read
the state as a diagnostic and deep-link instead. Wrap every Settings intent in a
`ActivityNotFoundException` fallback.

## 11. Catch-up, and why it must be bounded

Well-tested calendar apps do not rely on the OS delivering each alarm. They persist a **delivery
watermark** — a "last handled" timestamp — and on every trigger display everything in
`(watermark, now]`, re-arming from the watermark. A dropped or late alarm still surfaces, and the
chain self-heals.

**A watermark cannot tell "never delivered" from "delivered and ignored."** Nothing of yours runs
when an alarm fires, so `(watermark, now]` with no acknowledgement includes every item the user
*saw* and simply did not act on. If acknowledging is optional in your app — logging a dose,
ticking a task — that is the normal path, and the next sweep re-posts a whole day of items the
user already handled. Found on a day-boundary test: sync, cross midnight, sync again.

The missing signal is the plugin's own store. `ScheduledNotificationReceiver` →
`scheduleNextNotification` → `removeNotificationFromCache` drops a one-shot the moment its
receiver runs, so at sweep time:

- **id gone from `pendingNotificationRequests()`** → it fired. Leave it alone.
- **id still there** → it never fired: phone off across the instant, or a force-stop cleared the
  real `PendingIntent` while leaving the plugin's bookkeeping intact — the very drift the sweep
  exists for.

Ask about the id the alarm was **armed** under, not the id of the notification you are about to
post — they differ whenever the sweep drops an expired member, and an id that was never scheduled
answers "still pending" every time, defeating the gate silently. Read the pending set **once,
before the reconcile's cancel loop**; cancelling a spent id erases the evidence. Model both halves
in the fake sink your tests use: arming adds an id, firing removes it.

Two cautions:

- **A WorkManager periodic worker is not an independent second path.** Google's
  `isBackgroundRestricted()` reference states jobs and alarms will not execute under restriction
  "even when the device is charging". It is suppressed by the *same* condition, so it is
  correlated, not redundant.
- **Bound the catch-up.** Unbounded replay is fine for calendar events and actively dangerous for
  anything time-sensitive. For medication, most doses are only safely taken up to ~2 hours late
  (NHS Specialist Pharmacy Service), so replaying a day of missed doses as fresh actionable
  alerts is an instruction to overdose. Surface an expired item as a **non-actionable "missed"**
  state, distinct from a live reminder. Etar bounds revival to 24 h and to still-live events;
  copy that instinct, not an unbounded replay.

**A notification cannot be rewritten once the OS holds it.** It is serialised at schedule time and
nothing of yours runs when it fires. So a reminder that might be delivered late has to say when it
was *due* in its own body from the moment it is scheduled — "Omeprazole · due 20:00", not
"Omeprazole". There is no hook in which to add that later.

The same absence of a fire-time hook governs a **re-nag** (a second, dismissible nudge at
`min(10 min, ¼ of the gap to the next occurrence)`, which beats a sticky `setOngoing` one nobody
can dismiss). "Only if still unacknowledged" cannot be evaluated when it fires, so enforce it from
the planning end: plan a nudge only for an item with no answer logged, and **re-plan on every path
that writes an answer** — in-app, the foreground notification action, and the background action
isolate. Otherwise the nudge already armed in the OS fires after the user has answered.

Budget for it: a nudge doubles the alarms per item, so a fixed alarm cap covers roughly half the
horizon it did before (§9).

## 12. Gotchas

- **`initializeTimeZones()` + `setLocalLocation`** before `zonedSchedule`, or it throws / fires in
  the wrong zone.
- **Never blanket-`cancelAll()` in a re-sync** — it deletes unread notifications from the shade
  and is non-atomic. Reconcile per-id (§8).
- **Set `category: AndroidNotificationCategory.alarm`** or DND silences you (§5).
- **Channel behaviour is immutable after creation**, including across delete-and-recreate of the
  same id. Rotate the id.
- **`exactAllowWhileIdle` is not immune to background restriction** — only `setAlarmClock` is, and
  it discloses your next alarm to every app on the device (§4).
- **Background action isolate has no app state** — `ensureInitialized()`, re-select the FFI
  factory, open a **private** DB with an explicit path, close in `finally`.
- **Resolve locale from settings in background isolates**, never hardcode `Locale('en')`.
- **`@pragma('vm:entry-point')`** on the background callback or AOT strips it.
- **Stable ids** so re-sync replaces, not duplicates. Watch for hash collisions if you mask to 31
  bits.
- **Budget every reminder class** (§9), and stay under 64 pending on iOS.
- **Android actions per-notification, iOS actions in a category** — supply both.
- **Cold-start tap** comes from `getNotificationAppLaunchDetails`, not the runtime stream.
- **Share the write logic** between foreground and background action paths.
- **A scheduled notification's text is frozen** — put the due time in the body up front (§11).
- **Re-plan after every answer**, or an already-armed nudge fires at someone who answered (§11).
- **A catch-up sweep needs "was it delivered?", not just "was it acknowledged?"** — the plugin's
  pending list is the only witness (§11).
- **A coalesced notification needs a multi-target payload**, or its action button answers for one
  item and abandons the rest (§8).

## 13. Diagnosing a real device

Grants and pending-alarm counts look healthy in almost every broken case. The decisive check is
the **event log**, which distinguishes "never posted" from "posted then killed":

```bash
adb logcat -b events -d -v time | grep -i notification | grep -i <your.package>
```

`notification_enqueue` → `notification_alert` → `notification_canceled` with a reason code tells
you the whole story. Reason `9` is `REASON_APP_CANCEL_ALL` — *your own app* called `cancelAll()`.

Supporting commands:

```bash
adb shell dumpsys alarm > /tmp/alarm.txt
grep -B1 "tag=\*walarm\*:<pkg>/com.dexterous" /tmp/alarm.txt   # pending alarms + fire times
grep -A6 "u0a[0-9]*:<pkg>" /tmp/alarm.txt                       # did it actually fire, and when
grep -A20 "Restricted packages:" /tmp/alarm.txt                 # background-restricted?
adb shell cmd appops get <pkg> | grep RUN_ANY_IN_BACKGROUND

adb shell dumpsys notification --noredact > /tmp/n.txt
grep -o "NotificationChannel{mId='reminders'[^}]*}" /tmp/n.txt  # importance, bypassDnd, audio usage
grep -E "mZenMode=|mInterruptionFilter=" /tmp/n.txt             # DND state
```
