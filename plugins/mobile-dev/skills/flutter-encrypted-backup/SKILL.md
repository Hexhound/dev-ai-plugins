---
name: flutter-encrypted-backup
description: Use when a Flutter app needs a full encrypted backup/restore — pack the SQLite database plus attachment files into one versioned, password-encrypted archive that can be written locally or uploaded to the cloud, with change-detection, a pluggable destination interface, a kill-safe restore, and optional scheduled headless backups.
---

# Encrypted backup & restore (single sealed archive)

Pack **everything needed to reconstruct the app on a new device** — the SQLite snapshot(s), all
attachment files, and a manifest — into one self-describing encrypted file, written to any
destination (local folder, cloud). Zero-knowledge: the key is derived from the user's password
so the storage provider can never read a backup. This is the pattern proven in caremate's
`.cmbak` format.

Builds on `flutter-encryption-at-rest` (escrows its data-key), and pairs with
`flutter-google-drive-sync` / `flutter-android-saf-folder` (destinations) and
`flutter-home-screen-widgets` (the same alarm-isolate scheduling pattern).

## Contents

1. What gets backed up (and how to snapshot a live DB)
2. Dependencies
3. The container format — plaintext header + encrypted payload
4. Versions (forward-compat) and the too-new gate
5. Split the code: pure codec vs. platform glue
6. The password key + why you cache the *derived* key
7. Escrowing the attachment data-key
8. Change detection (don't re-do work)
9. Pluggable destinations
10. Restore (atomic, kill-safe, ends the process)
11. Scheduling headless backups
12. Gotchas

## 1. What gets backed up

- **The SQLite database** — snapshot with `VACUUM INTO`, never a file copy. A running DB has a
  `-wal` sidecar; a raw copy is inconsistent. `VACUUM INTO` writes a clean, single-file,
  transactionally-consistent copy:
  ```dart
  await db.execute("VACUUM INTO '${snapPath.replaceAll("'", "''")}'"); // literal, not a param
  ```
- **Every other database the app keeps** (e.g. a device-level settings DB beside the main one)
  — each through its own `VACUUM INTO`, on a **private** connection (`singleInstance: false`,
  see §12). A DB in rollback-journal mode being written by the foreground holds an EXCLUSIVE
  lock the vacuum bounces off with `SQLITE_BUSY`, and `busy_timeout` may not cover it — wrap
  the vacuum in a short retry-with-backoff, or a backup taken while the user flips a setting
  just fails.
- **All attachment files** — copied *verbatim* (they're already ciphertext from
  `flutter-encryption-at-rest`), keyed by forward-slash relative path.
- **A manifest** — versions, file list, content checksum, and the **escrowed attachment
  data-key** (without it, restored `.enc` files are undecryptable on a new device).

**Keep backup bookkeeping (`last_backup_at/_size/_checksum`) out of the snapshot.** Recording
a backup writes those fields; if they're in a snapshotted DB, every checksum is a digest of the
previous run's checksum and change-detection never skips. Best: store them somewhere that is
never snapshotted. If they must live in a snapshotted DB, scrub them **from the copy** and then
`VACUUM INTO` a second time — an in-place `UPDATE` leaves the rewritten page laid out around the
old value, so the bytes still differ run to run; only a vacuumed file is canonical.

Two more snapshot rules:
- **Never open a DB path that doesn't exist.** sqflite creates it — you'd archive a valid-looking
  *empty* database, and restoring it silently wipes the user. Check `File(path).exists()` and fail.
- **Delete the temp snapshot dir in a `finally`** — they're DB-sized, and a backup that keeps
  failing otherwise piles them up in temp.

## 2. Dependencies

```yaml
dependencies:
  archive: ^4.0.0             # read+write binary zip (the pack/unpack)
  cryptography_plus: ^3.0.0   # AES-256-GCM + Argon2id
  flutter_secure_storage: ^9.2.4
  sqflite: ^2.4.2+1
  path: ^1.9.1
  path_provider: ^2.1.4
  android_alarm_manager_plus: ^5.0.0  # scheduled runs (§11)
  workmanager: ^0.10.10               # network-constrained run (§11)
```

## 3. The container format

A single file: **plaintext header** (readable before you have the key — it carries the KDF
salt/params and the version) followed by the **AES-256-GCM payload**. No secrets in the header
(a salt is not secret):

```
MAGIC       "CMBK"            4 bytes   — reject foreign files
FORMAT_VER  uint16 LE         2 bytes   — the version gate
HEADER_LEN  uint32 LE         4 bytes
HEADER_JSON utf8 json         N bytes   — {formatVersion, createdAt, appVersion, cipher, secret{}}
PAYLOAD     AES-256-GCM blob  rest      — nonce ‖ ciphertext ‖ tag
```

`parseBackup` validates magic, **refuses a `formatVersion` newer than this build**
("update the app"), rejects below `minSupportedVersion`, and splits header/payload. The
payload decrypts to a zip (`archive`) of `manifest.json` + `db/<name>` (one entry per database)
+ the attachment files.

## 4. Versions (forward-compat) and the too-new gate

Mirror the DB migration pattern with **two independent versions**:

- **`formatVersion`** (header, plaintext) — the *container* layout. Restore reads it first and
  gates on it. **Bump it whenever an older reader would silently drop data** — e.g. adding a
  second database to the archive: an old reader would restore the one DB it knows and discard
  the rest. The bump turns that into "update the app".
- **`payloadVersion`** (manifest, inside the encrypted zip) — the *contents* layout.

When decoding, **fork on manifest *shape*, not on the header version** (a missing key means
"older archive") and normalise old shapes into the current one, e.g. synthesise the single-DB
entry an old archive implies, so everything downstream sees one shape.

The DB's own `user_version` travels inside the snapshot. **Older** is fine — your normal
`migrate()` ladder upgrades it on first open. **Newer is not**, and it is the restore's biggest
trap: sqflite's default `onDowngrade` silently **restamps `user_version` down** and opens the
file. Nothing breaks until that device updates, re-runs a migration whose changes are already
there (`duplicate column name`), rolls back, and retries identically on every launch — stranded
forever. So:

```dart
// in openDatabase: never the default, never onDatabaseDowngradeDelete (deletes user data)
onDowngrade: (db, from, to) async => throw DatabaseDowngradeException(from, to),

// before restoring: read user_version straight from the SQLite file header — no connection
int? fileSchemaVersion(List<int> b) =>
    b.length < 64 ? null : (b[60] << 24) | (b[61] << 16) | (b[62] << 8) | b[63];
if ((fileSchemaVersion(payload.db) ?? 0) > AppDatabase.version) throw BackupFormatException('update the app');
```

## 5. Split the code: pure codec vs. platform glue

The single most important structural decision — it's what makes backup unit-testable:

- **`BackupCodec`** — *pure*: no filesystem, no DB. `seal(payload, key, secret) -> bytes` and
  `open(bytes, key) -> payload`, plus `readHeader` and `checksumOf`. Tests drive it with
  in-memory bytes and a `SecretKey`.
- **`BackupService`** — thin platform glue: `VACUUM INTO`, list attachment files, export the
  data-key, stage/swap files on restore. Directories injectable for integration tests.

```dart
Future<Uint8List> seal(BackupPayload payload, {required SecretKey key, required BackupSecret secret, required String createdAt, required String appVersion}) async {
  final archive = Archive()
    ..addFile(_file('manifest.json', utf8.encode(jsonEncode(manifest.toJson()))))
    ..addFile(_file('db/app.db', payload.db));
  for (final e in payload.attachments.entries) archive.addFile(_file(e.key, e.value));
  final box = await _algorithm.encrypt(ZipEncoder().encodeBytes(archive), secretKey: key);
  return assembleBackup(BackupHeader(formatVersion: 2, createdAt: createdAt, appVersion: appVersion, secret: secret), box.concatenation());
}
```

## 6. The password key + why you cache the *derived* key

The backup key is 256-bit, **Argon2id-derived from the user's password** over a random salt
(salt + params recorded in the plaintext header so any device reproduces the key from the same
passphrase). This is the only method that satisfies *restore after an app-data clear, on a new
phone, or a different OS, with zero knowledge* — the provider never sees the key.

```dart
Future<SecretKey> deriveFromPassword(String password, {required List<int> salt, BackupKdfParams params = const BackupKdfParams()}) {
  return Argon2id(memory: params.memKiB /*64MiB*/, iterations: params.iterations, parallelism: params.parallelism, hashLength: 32)
      .deriveKey(secretKey: SecretKey(utf8.encode(password)), nonce: salt);
}
```

**Cache the derived key, not just the password.** Argon2id at 64 MiB takes many seconds, and a
headless run must not spend its budget on it. So derive **once** (foreground, at
configure/password-change) and cache the key + salt in secure storage; every later seal
(headless or manual) reuses it, turning an ~18 s run into ~2–3 s:

```dart
Future<({SecretKey key, Uint8List salt})> deriveAndCache(String password) async {
  final salt = newSalt(); final key = await deriveFromPassword(password, salt: salt);
  await _store('backup_password_v1', password);
  await _store('backup_key_v1', base64Encode(await key.extractBytes()));
  await _store('backup_key_salt_v1', base64Encode(salt));
  return (key: key, salt: salt);
}
Future<({SecretKey key, Uint8List salt})?> ensureKey() async =>
    await cachedKey() ?? (await storedPassword() case final pw?) ? deriveAndCache(pw) : null;
```

Reusing one salt per password is fine — each `.cmbak` still gets a fresh AES-GCM nonce.
`clearPassword()` (turn-off) must drop the cached key too. **Lost + forgotten password =
unrecoverable, by design** — warn about this explicitly in set/change flows.

## 7. Escrowing the attachment data-key

Attachment `.enc` files are sealed with the *device* data-key (see
`flutter-encryption-at-rest`), which never leaves the device on its own. Copying the files but
not the key = unrecoverable. **Chosen approach:** put the 32-byte device data-key in the
manifest — itself protected because the whole payload is encrypted with the backup key. On
restore, write it back into secure storage and the `.enc` files just work. (The rejected
alternative — decrypt+re-encrypt every attachment under the backup key — doubles crypto work
over large files on every run.)

## 8. Change detection (don't re-do work)

Content-address backups by a **SHA-256 over the plaintext payload** (every DB snapshot +
each attachment, length-prefixed and labelled, in a deterministic sorted order). Checksum the
**plaintext, never the ciphertext** — AES-GCM's random nonce makes identical content encrypt to
different bytes. **Every archived DB goes into the digest** — leave the settings DB out and a
theme change or purchase is skipped as "unchanged". Don't hash the same bytes twice if one
buffer appears under two manifest entries (hash it once; bind the second label with an empty
chunk).

```dart
// scheduled or manual run:
final snap = await service.snapshot();               // VACUUM + list + checksum
if (snap.checksum == settings.lastBackupChecksum) {  // nothing changed
  await repos.settings.patch({'last_backup_at': now}); // just record we checked
  return;                                              // skip encrypt + upload entirely
}
// else: seal, store, then persist checksum + timestamp + size
```

## 9. Pluggable destinations

A destination only moves **opaque sealed bytes** — orthogonal to encryption and to the
schedule. One interface, interchangeable implementations:

```dart
abstract interface class BackupStore {
  Future<bool> isAvailable();                                  // local: always; Drive: signed-in?
  Future<BackupEntry> store(Uint8List bytes, {required String stamp, int keep = 3}); // rolling, pruned
  Future<List<BackupEntry>> list();                            // newest first
  Future<Uint8List> fetch(BackupEntry entry);
  Future<void> delete(BackupEntry entry);
}
```

`LocalFileDestination(dir)` writes `app-backup-<YYYY-MM-DD>.cmbak`, prunes to the newest
`keep`, and lists by name (the date stamp sorts chronologically). A `DriveDestination` is the
cloud counterpart (see `flutter-google-drive-sync`). The caller supplies the date stamp — keep
the clock *out* of the service so it's deterministic in tests.

## 10. Restore (atomic, kill-safe, ends the process)

**Restore must not require backups to be set up.** The key comes from the password and the
salt *in the backup's own header* — the device's configuration never enters into it. Offer
restore from the "backups off" state too (ask for the source: local file or cloud), and after a
password opens the backup, **offer to turn backups on with that same password** (derive+cache
once) instead of asking the user to invent a second one.

### Before anything is touched

```dart
final header = codec.readHeader(bytes);            // learn secret method BEFORE prompting
final key = /* cached key if salt matches, else deriveFromPassword(password, header.salt) */;
final payload = await codec.open(bytes, key: key); // wrong key throws here
// every "this build can't restore that" check goes HERE, while the app still works:
//   schema too new (§4), content this build can't place (more DBs than it knows), ...
final dbPath = await resolveLiveDbPath();          // the real path, not a default (§12)
await liveDb.close();                              // overwriting an open SQLite file corrupts it
await service.applyRestore(payload, dbPath: dbPath);
// → restart the process (below). Never reopen and carry on.
```

A refusal after the close leaves a dead app; a refusal before it costs the user nothing.

### Stage → commit marker → rename (atomic against a kill)

"Write the DB last" only protects against a *thrown error*. A **process kill** mid-rewrite still
leaves half-replaced attachments against the old DB, or a truncated DB file. Make it atomic:

1. Write **everything** (DB bytes, attachment tree — even an empty one, so old files don't
   survive) into `restore_staging/`, where nothing reads it. **Reject any attachment path that
   resolves outside staging** (`..`, absolute segments) — don't skip it silently.
2. Write a **commit marker** (`restore.commit`, `flush: true`) — the single point of no return.
   It must be **self-describing**: staging dir, DB file name **and its target directory**,
   attachment dir, escrowed data-key, and any post-swap values. The build that resumes it may
   not be the build that wrote it, and the storage layout may have moved in between; a missing
   key means the old default.
3. `_commit` (idempotent, every step checks whether it already happened, always rolls
   *forward*):
   - import the data-key **first** (a live tree without its key is undecryptable);
   - **park** the live attachment tree (`rename` to `*.retired`), rename staging's tree live,
     then delete the parked one — a recursive delete is a window with no tree live;
   - drop derived caches of the old tree (thumbnails/previews keyed by reused paths);
   - **delete the live DB's `-wal`/`-shm`/`-journal` *before* renaming the staged DB in** — a
     fresh DB beside a stale WAL gets that WAL replayed into it (corruption);
   - delete staging, and **delete the marker last**.

On launch, **before any DB is opened** (but after selecting the SQLite factory, so every open
uses the same engine):

```dart
Future<void> finishInterruptedRestore({void Function(Object, StackTrace)? onError}) async {
  if (!await marker.exists()) { await deleteIfExists(staging); await deleteIfExists(retired); return; } // never committed → rollback
  await _commit(...);                                                      // committed → roll forward
}
```

Boot-loop guards — this runs before the app on every launch, so it must never throw forever:
- **Unreadable marker, or one naming paths outside the documents dir** → drop marker + the
  *default* staging dir (never the marker's), leave live files as they are.
- **Non-essential post-swap steps** (e.g. applying restored preferences to another DB) go in a
  `try/catch` reported via `onError` — a column dropped by an app update between the kill and
  the relaunch would otherwise fail the same way on every launch.

### What a restore may carry across

Device-specific state describes the phone that *made* the backup: backup destination, folder
grant, cloud account, schedule, `last_backup_*`. **Purchase entitlements** (ad-free, pro) are
not preferences — restoring them makes the purchase transferable by sending someone a file; the
store is the authority ("Restore purchases"). Keep an explicit **allow-list** of restorable
settings, and apply it **twice**: when reading from the staged backup, and again when `_commit`
reads the marker (a resumed marker may come from a build with a wider list). If the archive
contains a second DB, don't swap it in wholesale — read the allowed values out of it. Read old
values from the staged file opened **without `version:`** (so no `onUpgrade` migration drops
the columns you're reading).

### End the process

A swapped DB file is only read correctly by a **new process** — sqflite's single-instance cache
and every open connection live in the process, so re-running `main` isn't enough. After the
close, the restore sheet must be **inescapable**: `enableDrag: false` on the route (a drag-close
calls `Navigator.pop` directly; `PopScope` can't veto it), and its only exit restarts the app —
on success *or* failure. Android: `ProcessPhoenix.triggerRebirth` via a method channel (Android
10+ blocks background activity starts, so an alarm-plus-`exit` trick doesn't work). iOS has no
supported relaunch: `exit(0)` with "reopen the app" wording.

**If the app syncs** via trigger-built change logs/outboxes: a file swap fires no triggers, so
no restored row is ever published and the queued outbox is destroyed. Before the close, record
the outgoing DB's row identities beside the file; on next start publish every restored row and
tombstone the rows the backup lacks (a restore sets the record back, it doesn't merge), and
clear per-peer sync checkpoints that came out of the backup.

## 11. Scheduling headless backups

Two stages, because neither Android mechanism does the whole job:

1. **An exact alarm** (the `flutter-home-screen-widgets` pattern: `android_alarm_manager_plus`,
   fixed id, `@pragma('vm:entry-point')` callback, `rescheduleOnReboot: true`) fires at the
   chosen time, **re-arms the next alarm first**, and queues stage 2. `oneShotAt` is one-shot;
   a startup `sync()` in `main()` is the backstop.
2. **A WorkManager one-off task** does the backup. An alarm isolate gets ~10 s of network before
   Android blocks background access (`blocked=APP_BACKGROUND`) and is frozen after ~20 s — not
   enough to authorise, let alone upload. A job with a network constraint is exempt, runs up to
   ~10 min, and waits for the allowed network (`unmetered` for a "Wi-Fi only" setting, else
   `connected`). Use `ExistingWorkPolicy.keep` (a run still waiting isn't queued twice),
   exponential backoff, `update` when the Wi-Fi setting changes, and **cancel it when backups
   are turned off**. "Back up now" ignores the network setting.

```dart
@pragma('vm:entry-point')
Future<void> backupAlarmCallback(int id) async {
  WidgetsFlutterBinding.ensureInitialized();
  var rearmed = false;
  try {
    initSqliteFfi();
    final settings = await loadSettingsPrivately();                  // private conn, closed here
    await BackupScheduler.sync(settings, now: DateTime.now());      // re-arm NEXT run first
    rearmed = true;
    if (BackupScheduler.canRunUnattended(settings)) await BackupScheduler.queueRun(settings);
  } catch (e, st) {
    debugPrint('backupAlarmCallback failed: $e\n$st');
  } finally {
    if (!rearmed) await BackupScheduler.armFallbackRetry(DateTime.now());  // next midnight
  }
}

@pragma('vm:entry-point')
void backupWorkDispatcher() => Workmanager().executeTask((task, _) async {
  if (task != BackupScheduler.workName) return true;
  try { return await runQueuedBackup(); }   // true: done, skipped, or blocked-and-notified
  catch (_) { return false; }              // false: WorkManager retries (transient)
});
```

Rules:
- **Self-heal in a `finally`.** "Arm first" still runs *after* settings load; if that throws,
  the chain is dead until the app is reopened. The `rearmed` flag + fallback retry fixes it.
- **Open the *real* DB path in every isolate**, resolved the same way the foreground resolves
  it. A pathless/default open creates an empty DB and backs *that* up.
- **"Settings not migrated yet" is not "backups off".** An alarm rescheduled across a reboot can
  fire after an app update but before its first foreground launch, when first-run migrations
  haven't moved the backup config where the isolate reads it. Defaults then say "not
  configured", and `sync` would *cancel* the schedule for good. Run the same idempotent
  first-run/bootstrap step in the isolate, or treat an unmigrated store as unknown and leave
  it to the fallback retry.
- **Cloud auth headless:** interactive sign-in needs an Activity and fails silently in the
  background (e.g. google_sign_in's lightweight auth returns null). Remember the connected
  account and request *authorization* directly (see `flutter-google-drive-sync`).
- **Tell the user when only they can fix it.** A run blocked on revoked cloud consent, a revoked
  folder grant or a missing stored password posts one fixed-id "Backups paused" notification
  (tap → backup screen); any successful backup clears it. Otherwise the alarm keeps re-arming,
  the schedule *looks* healthy, and nothing is ever uploaded. Log each run's outcome
  (uploaded / skipped unchanged / blocked).
- Only arm when `canRunUnattended` (configured + non-off frequency + a cached key).

## 12. Gotchas

- **`VACUUM INTO`, never a file copy** of a live DB (`-wal` inconsistency). It can't run inside
  a transaction — pass the app-level `Database`. Retry it on lock contention for a
  rollback-journal DB.
- **Backup bookkeeping out of the snapshot** (or scrub + re-vacuum the copy) or
  change-detection never skips (§1).
- **Never snapshot a missing DB path** — sqflite creates an empty one.
- **Private connections for any throwaway open.** sqflite caches single-instance DBs by path
  process-wide with no refcount. Any helper that opens a DB only to read something and then
  closes it — an isolate, *or a foreground helper like "resolve the live DB path"* — must use
  `singleInstance: false`, or its `close()` kills the running app's handle.
- **Checksum the plaintext of every DB, not the ciphertext** (random nonce).
- **Header carries no secrets** — it must be readable before you have the key.
- **Cache the derived key** for headless runs; caching only the password re-runs Argon2id.
- **Re-arm in a `finally` (`rearmed` flag → fallback retry)** (§11).
- **Do the network work in WorkManager, not the alarm isolate** (~10 s network allowance).
- **Escrow the attachment data-key** in the (encrypted) manifest, or restored files are dead.
- **Refuse newer `formatVersion` *and* newer DB `user_version`**, and give the DB an
  `onDowngrade` that throws — sqflite's default silently restamps and strands the install (§4).
- **Restore = stage + commit marker + rename, resumed from `main()` before any DB open**; delete
  WAL sidecars before the rename; the marker records its own target paths (§10).
- **Close the DB before the swap, run every refusal before the close, restart the process
  after** — never let the user keep using a connection whose file was replaced.
- **Never restore purchases or device-bound settings** — allow-list, applied twice (§10).
- **Keep the clock and the filesystem out of the codec** — pass the date stamp and inject dirs,
  so the core is pure and testable.
- **Destination sees only opaque bytes** — never a key or plaintext; this keeps local/cloud
  swappable and keeps ciphertext-only on any third-party server.
