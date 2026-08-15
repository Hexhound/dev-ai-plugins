---
name: flutter-multi-device-sync
description: Use when a Flutter app with a local SQLite database needs to sync across the user's own devices end-to-end encrypted — capture local writes with database triggers (not repositories), project inbound changes back into SQLite without echoing them, map rows onto a CRDT as last-writer-wins, move attachment files as blobs with a reclaim queue, and drive it all from one cycle with backoff. Covers the build order, the test ladder, and the failure modes that are silent.
---

# Multi-device sync over a local SQLite database

Give an offline-first app a second device. The database stays the source of truth for
the UI; a CRDT vault becomes the source of truth for *convergence*; and two narrow
pieces of machinery move rows between them — an **outbox** going out, a **projection**
coming in. This is the pattern proven in caremate over roam-sync.

Builds on `flutter-sqlite-ffi-fts5` (the schema and migration ladder it extends) and
`flutter-encryption-at-rest` (whose per-device data-key is why attachments need a third
key). Pairs with `flutter-device-pairing-ui` for the screens. The sync library itself is
documented by the `roam-dev` plugin — read `roam-sync-overview` first if the choice of
library is still open; this skill is about the *app* side and is largely library-agnostic.

## Contents

1. Build order — what to do first, and why
2. The seam: one port, two implementations
3. The policy file — what syncs, declared once
4. Rows onto a CRDT: containers, keys, and whole-row LWW
5. The row codec (and why not `jsonEncode`)
6. Capture: triggers, not repositories
7. Suppression — the loop you must not create
8. Projection: foreign keys, arrival order, and held rows
9. The cycle, and why publish comes first
10. Scheduling and backoff
11. Attachments: three keys, and a blob reclaim queue
12. Migrations and the backfill question
13. The test ladder
14. Gotchas

## 1. Build order

Do it in this order. Each step is verifiable on its own, and the risky one is first.

1. **The bridge, before any app code.** If the sync library is Rust, cross-compiling it
   for every ABI is the single largest unknown in the project and it is answerable in
   isolation. A spike that gets `open` + `put` + `read` working on a real handset settles
   it. If it fights back, the fallback (relay-only, no P2P transport) is a much smaller
   dependency surface and is a legitimate product.
2. **The policy file** (§3) — cheap, and it makes every later argument concrete.
3. **The port + a fake** (§2). Everything after this is testable with no device.
4. **Codec → outbox → projection → engine → scheduler.** Bottom-up; each has real tests
   before the next exists.
5. **The service facade**, then the UI.
6. **Attachments last.** They are a separate transport with separate failure modes, and
   rows syncing without files is a coherent intermediate state to ship against.

## 2. The seam: one port, two implementations

Define a `VaultPort` in app terms — put, delete, read, observe — with **no network in
it**. Reconciling is a separate callback. This is what lets every test above the port run
against an in-memory fake, and it is the highest-leverage decision in the feature.

```dart
abstract interface class VaultPort {
  Future<void> put(String container, String key, String payload);
  Future<void> delete(String container, String key);
  Future<Map<String, String>> entries(String container);
  Stream<VaultChange> get changes;
  Future<String> putBlob(List<int> bytes);      // returns a content hash
  Future<List<int>?> getBlob(String contentHash);
  Future<void> removeBlob(String contentHash);  // local-only
  Future<void> close();
}

/// The bits only a real vault has: identity, roster, reconcile, maintenance.
abstract interface class VaultSession implements VaultPort {
  Future<BigInt> get peerId;
  Future<void> syncOnce();
  Future<List<VaultPeerInfo>> roster();
  Future<void> revokePeer(BigInt peerId, List<int> verifyingKey);
}
```

Split `VaultSession` out so the engine, outbox and projection depend only on `VaultPort`
— the small half — while pairing and the device list take the large one.

Write a `FakeVault` that models **several devices sharing one relay**, not one device.
Tests that only ever exercise a single device cannot catch a convergence bug.

## 3. The policy file — what syncs, declared once

One file, no logic, both directions:

```dart
const syncedTables = <String>{'journeys', 'events', 'doctors', /* … */};

/// Excluded, each with the reason. Writing the reason down is the point.
const unsyncedTables = <String, String>{
  'search_fts': 'derived — triggers rebuild it from the projected rows',
  'sync_outbox': "this device's queue of writes waiting to be published",
  'sync_control': "this device's publish-suppression flag",
  'sync_blob_gc': "this device's queue of blobs whose last row was deleted",
};
```

Three rules this encodes:

- **Never sync derived tables.** An FTS index rebuilds itself from projected rows via its
  own triggers — replicating it doubles traffic to reproduce something SQLite regenerates,
  and a stale copy is worse than none.
- **Never sync your own machinery.** A peer receiving this device's outbox would queue it
  and send it back. Same for the suppression flag and the blob-reclaim queue: those are
  questions about *this* device's copy.
- **A single-row settings table cannot be synced as a row.** Every device writes `id = 1`,
  so row-level LWW makes any change on one device clobber concurrent changes on another.
  Sync **individual columns as individual keys** instead, from a `syncedSettingsColumns`
  set, and two devices changing two different preferences both win.

## 4. Rows onto a CRDT

One synced table → one CRDT map ("container"). One row → one key. The value is the encoded
row. Since every repository already exposes `toMap()`/`fromMap()`, this needs **no
per-model code**.

The consequence to state out loud in the code and to the user: conflicts are **whole-row
last-writer-wins**. Two devices editing two different columns of the same row means one
write wins entirely. For a single-user multi-device app that is rare and acceptable; the
op log keeps the loser recoverable. If your app has genuine concurrent editing of the same
record, this mapping is the wrong one.

Encode the key from the primary key, with a real encoder (`RowKey.encode(table, identity)`)
that percent-encodes separators — composite keys otherwise collide the first time an id
contains your delimiter.

## 5. The row codec

Do **not** use bare `jsonEncode`. Two reasons, both correctness:

- **Blobs.** A SQLite column can hold `Uint8List`, which JSON cannot represent —
  `jsonEncode` *throws*, taking down the sync loop the first time one appears. Tag and
  base64 byte values.
- **Determinism.** Dart map iteration is insertion-ordered, so two devices building the
  same row in different orders produce different bytes for identical data. Harmless to a
  LWW map, but it defeats every cheap "did this change?" byte comparison, so every no-op
  write becomes a real op. **Sort the keys.**

Carry an envelope version. A decoder that meets a version it does not know **returns null
and the caller skips the row** — never an empty map, which a caller would happily write
over real data.

```dart
static const int version = 1;  // bump for envelope shape, NOT for a new column
```

## 6. Capture: triggers, not repositories

**This is the decision that most often gets made wrong.** A repository that writes the row
and then publishes has a gap between the two. If the process dies in that gap — and on
Android it will — the row is in SQLite, never in the vault, and nothing notices: there is
no reconciliation pass, so it stays invisible to the other devices for good.

A trigger writes the outbox entry **inside the same transaction as the data**, so the write
and the intent to publish commit or roll back together.

The second reason is coverage, and it is the one that bites later. Rows move by paths that
never touch a repository: `ON DELETE CASCADE`, `ON DELETE SET NULL`, migrations, and
whatever gets added next year. Triggers sit underneath all of it. Per-repository publish
calls cover only the paths someone remembered, and the failure mode is silent divergence.

```sql
CREATE TABLE sync_outbox (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL, pk1 TEXT NOT NULL, pk2 TEXT,
  op TEXT NOT NULL CHECK (op IN ('upsert','delete'))
);

CREATE TRIGGER sync_events_au AFTER UPDATE ON events
WHEN (SELECT suppressed FROM sync_control WHERE id = 1) = 0
BEGIN
  INSERT INTO sync_outbox (table_name, pk1, pk2, op)
  VALUES ('events', new.id, NULL, 'upsert');
END;
```

**Record identity only** — table plus primary key columns, raw. Not the encoded container
key: SQL cannot percent-encode, so a trigger building keys would be a second, subtly
different encoder beside the Dart one. The pump reads the current row and encodes in Dart,
which also means a row written five times between drains publishes once, in its final state.

At-least-once is enough. LWW makes duplicate publication a no-op.

Drain notes that matter:
- **Collapse per row** before publishing (last entry wins: upsert-then-delete is a delete).
- **Take a high-water mark** at the start and delete only `seq <= mark`, so a row written
  while the drain ran keeps its place instead of being silently dropped.
- A row whose entry says upsert but which **no longer exists** should publish a *delete* —
  the delete that followed it collapsed into the same slot.
- If your app seeds demo data on install, exclude seed rows (`WHEN new.is_seed = 0`), or a
  paired device ends up with two copies of the same fictional content.

## 7. Suppression — the loop you must not create

The projection must not re-enqueue what it applies. Two devices each republishing what they
receive would trade the same row forever.

```dart
static Future<T> suppressed<T>(DatabaseExecutor txn, Future<T> Function() body) async {
  await txn.update(syncControlTable, {'suppressed': 1}, where: 'id = 1');
  try { return await body(); } finally {
    await txn.update(syncControlTable, {'suppressed': 0}, where: 'id = 1');
  }
}
```

The flag lives **in the database**, not in memory, because the triggers read it from SQL.
That looks like it would leak across isolates — a background isolate holds its own
connection — but it cannot: the flag is set and cleared inside a write transaction, and
SQLite serialises writers, so no other connection can commit while it is set. A rollback
restores it for the same reason.

## 8. Projection: foreign keys, arrival order, held rows

Write inbound changes with **ordinary INSERT/UPDATE/DELETE**, not a bulk load. Per-row
triggers (the FTS index) then maintain themselves on every device for free — which is why
the index is excluded from replication rather than synced.

With `PRAGMA foreign_keys = ON`, a child row can legitimately arrive before its parent: a
CRDT guarantees ordering only per key. Applying in arrival order fails the constraint and
loses the row.

- **Sort each batch parents-before-children** by a static table rank, so parent and child
  arriving together both land whatever order the network produced.
- A row whose parent is genuinely absent is **held in memory and retried after each later
  batch**, not dropped. Held rows are safe in memory because startup re-bootstraps from
  `entries()`, which re-offers everything.
- After a batch lands, **loop the retry until a pass frees nothing** — a chain of held rows
  should resolve in one call, not need one inbound change per level.

**Do not use `defer_foreign_keys`.** Deferring works in SQLite, but the violation then
surfaces from `COMMIT`, and sqflite does not release the transaction lock on that path —
the next transaction blocks forever. Sorting keeps every failure inside the transaction
body, where a throw rolls back cleanly and the connection stays usable.

Report three counts, not a bool: `applied`, `held`, `dropped`. They mean different things
and only one of them is a problem.

## 9. The cycle

Order: **publish → transport → project.**

Publishing first is deliberate — a cycle that pushes before it pulls gives the merge both
sides in one round trip, so conflicting writes converge in one cycle rather than two.

Three details that are each a bug if missed:

- **Subscribe to the change stream at construction, not from `start()`.** A change arriving
  in the gap is dropped, and a CRDT reports a change *exactly once* — it is a delta, not a
  queryable log — so that row stays stale until something else touches it.
- **Yield once (`await Future<void>(() {})`) after transport**, before draining the inbound
  buffer. Stream events are delivered in a microtask, so what transport emitted has been
  added but not yet handed to the listener.
- **If projection throws, put the changes back** (`_inbound.insertAll(0, arrived)`). The
  vault will not report them a second time.

A transport failure is **not an exception**. On a phone, "could not reach the relay" is the
expected case, not an exceptional one; a scheduler catching an exception every subway ride
ends up swallowing real errors too. Return it on the report as `transportError` and let the
local halves' work stand.

`bootstrap()` (project everything `entries()` holds) is a separate entry point from
`cycle()`, for a freshly-paired device. The incremental path cannot substitute: a device
that was not present for a write never sees it in a delta.

Make concurrent `cycle()` calls **share one in-flight cycle** (`_running ??= …`). A periodic
timer and a pull-to-refresh landing together would otherwise double-drain and contend for
the same write transaction.

## 10. Scheduling and backoff

Split *when* from *what*. The scheduler is pure timing over an injected callback, so its
tests run in fake time with no I/O; the engine is tested against a real database. Mixing
them means every timing test needs a database.

Three triggers: **periodic** while foregrounded (there is no push — an idle app must ask),
**debounced after a local write** (a form fires a save per field; each is worth publishing,
none is worth its own round trip), and **on demand** for pull-to-refresh, which must not
wait for a debounce the user cannot see.

Back off exponentially on failure, reset on success, cap it. Drive backoff from
`report.reachedRelay`, not from exceptions — see §9.

## 11. Attachments: three keys, and a reclaim queue

Files are the exception to "everything is a row". The row names a path; the bytes are a
file. Two traps:

- **Do not ship the on-disk `.enc` bytes.** They are encrypted under a *per-device* key
  from the platform keystore. The other device cannot open them.
- **Do not hand the plaintext to the sync library.** Most blob stores encrypt for the
  *relay* but keep blobs plaintext at rest — that puts unguarded documents on disk,
  invisibly losing exactly the property the `.enc` files provide.

So: seal under a **third key derived from the vault key** before handing the bytes over,
open on arrival, and immediately re-seal under the receiving device's own data-key.

| key | scope | protects |
|---|---|---|
| device data-key | one device | the `.enc` file on that device |
| vault-derived file key | the vault | the blob in transit *and* at rest in the vault |
| vault key | the vault | everything the library itself seals |

**Identical files do not dedupe** if the seal uses a random nonce. Do not write a test that
assumes they do.

**Reclaiming.** Blob removal is local-only, and nothing else will ever do it. Use the same
trigger+sweep shape as the outbox:

```sql
CREATE TRIGGER blob_gc_attachments_ad AFTER DELETE ON attachments
WHEN old.blob_hash IS NOT NULL
BEGIN INSERT OR IGNORE INTO sync_blob_gc (content_hash) VALUES (old.blob_hash); END;
```

Then a sweep at the end of the cycle: for each queued hash, **re-check every attachment
table for a live reference** before removing, and leave it queued if removal throws.

Two decisions worth copying:
- These triggers are **not** gated by the suppression flag. A peer's delete orphans the
  local copy just as surely as a local delete does.
- **Do not reconcile against the vault's blob list** instead ("remove every blob no row
  names"). A blob routinely arrives *before* the row that names it, so that sweep deletes
  live data.

Order within the cycle: publish files → drain → transport → project → fetch files →
collect. Publish before drain so the `blob_hash` leaves with the row; collect last so the
reference check sees the rows this cycle just wrote.

## 12. Migrations and the backfill question

Bump the schema version and install the outbox, the control row, the triggers and the GC
queue in both `onCreate` and the migration ladder.

**Do not backfill the outbox at migration time.** Triggers only see writes that happen while
they exist, so every pre-existing row is invisible to them — but at upgrade time there is no
vault to publish into and possibly never will be. Do it at **pairing** instead, with an
`enqueueEverything()` that *queues* rather than publishes, so the ordinary drain carries it
out and an interrupted first publish resumes on the next cycle with no separate resume path.

Blobs orphaned *before* the GC feature existed stay orphaned, deliberately — see §11 for why
a reconcile sweep is unsafe.

## 13. The test ladder

In the order they pay off:

1. **Codec round-trips**, including a `Uint8List` column and an unknown envelope version.
2. **Migration tests** — that v_N installs the triggers *and that they capture*. Assert on
   the outbox contents after a write, not on the trigger's existence.
3. **Outbox**: collapse-per-row, delete-after-upsert, the high-water mark (write during a
   drain), suppression, seed exclusion.
4. **Projection**: child-before-parent in one batch, a genuinely-orphaned child held then
   released, an unknown container dropped, a newer envelope dropped.
5. **Engine** against a `FakeVault` with two devices: a write on A appears on B; a
   transport failure leaves the local halves' work intact.
6. **A real-vault pairing test** against a live relay. The fake cannot catch a bridge or a
   roster bug, and those are the ones that make a shipped build unusable.
7. **UI invariants** a widget test can hold — see `flutter-device-pairing-ui`.

## 14. Gotchas

- **A test that has never been watched to fail is not evidence.** Mutate the guard, watch
  the red, restore — and `git diff` before committing if the mutation run was interrupted.
  A "restored" backup taken *after* the mutation ships the mutation.
- **`testWidgets` runs a fake clock.** Real sqflite and vault work only advances inside
  `tester.runAsync`. An indeterminate spinner that never goes away means `pumpAndSettle`
  will never settle; interleave `runAsync(delay)` with `pump()` instead. A service with a
  periodic timer must be stopped inside the test body or the test fails on a pending timer.
- **Run the toolchain inside the project's dev shell.** A Flutter version mismatch produces
  failures that look like real bugs (shader/asset decode errors on anything with an ink
  splash) and a `pub upgrade` that is a downgrade wearing an upgrade's name.
- **Composite primary keys.** `pk2` must be nullable everywhere and must round-trip; the
  key encoder must escape the separator.
- **`ON DELETE SET NULL` fires an UPDATE, not a DELETE.** It is captured — that is the point
  of triggers — but check that the resulting upsert is what you want.
- **Local checkpointing/compaction can fight backend reconciliation.** If the library offers
  both, do not compact a vault that syncs through a relay until you have tested the
  interaction.
- **Bound what a response can make the client allocate.** A blob fetch that reads to EOF is
  an unbounded allocation on a handset; the failure mode is not an error, it is the process.
