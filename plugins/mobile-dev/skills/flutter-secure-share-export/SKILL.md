---
name: flutter-secure-share-export
description: Use when a Flutter app must share data via a private encrypted link (upload ciphertext, decryption key in the URL fragment, revoke by deleting the file) or produce a portable unencrypted "export everything" archive with a self-contained HTML viewer — one bundle builder feeding both paths.
---

# Secure share links + portable export

Two related capabilities from one core:

- **Share** — package a slice of the user's data into a self-contained HTML bundle, encrypt it
  with a fresh random key, upload the **ciphertext** to Drive, and hand the recipient a link
  whose **fragment carries the key**. The server never sees the key; deleting the file revokes.
- **Export** — the same bundle, unencrypted, as a browsable zip the user owns outright (no
  lock-in, no network).

Builds on `flutter-google-drive-sync` (upload) and `flutter-encryption-at-rest` (reads the
encrypted attachments back to plaintext for packaging).

## Contents

1. The link model: encrypt-and-forget
2. Dependencies
3. `ShareCodec` — fresh key per share, browser-decryptable
4. The self-contained viewer bundle
5. `prepare` vs. `upload` (size gate before network)
6. Revoke, record, manage
7. Export: the same bundle, in the clear
8. Gotchas

## 1. The link model: encrypt-and-forget

The recipient opens a static loader page; the URL **fragment** (after `#`) holds the Drive file
id + the AES key. The loader fetches the ciphertext from Drive, decrypts it in the browser with
WebCrypto, and renders. Crucially:

- **The fragment is never sent to any server** (browsers don't transmit `#…`), so the key stays
  between the two parties who have the link.
- **Whoever has the link can decrypt** — the key *is* the secret. This is the right model for
  "send my records to a doctor": no accounts, no recipient login.
- **Revocation = delete the Drive file.** The link then resolves to nothing.

```
https://loader.example.app/#<base64url(JSON({f: driveFileId, k: key}))>
```

The loader unzips in memory, turns every entry into a blob URL, and renders the archive's
viewer page in an iframe. **The loader is a contract with every archive already shared** —
links live for months and the zip inside can't be rewritten:

- Find the viewer page tolerantly: `index.html` if present (older archives), else the single
  `.html` at the archive root. Never hard-code the entry name.
- Change the loader first: **deploy it before the app release** that changes the archive
  layout, or new shares won't open.
- Anything the viewer asks of the loader over `postMessage` (e.g. "download the whole
  archive") needs a fallback for old viewers that don't send the new field — e.g. the
  `filename` to save as: use it only if it's a non-empty string ending in `.zip`, stripped of
  `/` and `\`, else a fixed default.

## 2. Dependencies

```yaml
dependencies:
  cryptography_plus: ^3.0.0
  # + your Drive layer (see flutter-google-drive-sync) and archive/zip (see below)
```

## 3. `ShareCodec` — fresh key per share, browser-decryptable

Unlike backup (owner-held password + Argon2id), a share is opened by someone who only has the
link — so **generate a fresh random AES-256-GCM key per share** and emit the **bare GCM
concatenation** (`nonce(12) ‖ ciphertext ‖ tag(16)`), no custom envelope, so the browser reads
it directly:

```dart
class SealedShare { final Uint8List bytes; final Uint8List key; } // key -> link fragment, never uploaded

Future<SealedShare> seal(Uint8List archive) async {
  final secretKey = await AesGcm.with256bits().newSecretKey();
  final keyBytes = Uint8List.fromList(await secretKey.extractBytes());
  // pure-Dart AES-GCM janks the UI isolate on a multi-MB archive — run it on a background isolate.
  // A SecretKey can't cross an isolate boundary; pass raw bytes and rebuild it there.
  final bytes = await Isolate.run(() => _encrypt(archive, keyBytes));
  return SealedShare(bytes: bytes, key: keyBytes);
}
static Future<Uint8List> _encrypt(Uint8List archive, Uint8List keyBytes) async =>
    Uint8List.fromList((await AesGcm.with256bits().encrypt(archive, secretKey: SecretKey(keyBytes))).concatenation());
```

The loader decrypts with:
`crypto.subtle.decrypt({name:'AES-GCM', iv: bytes.slice(0,12)}, key, bytes.slice(12))`.

## 4. The self-contained viewer bundle

Package the data as a zip: a static viewer page (bundled asset) + the decrypted attachment
files, laid out so a person can browse them (below). Inject the record data as JSON at a
marker in the template — **escape `<`** so a title containing `</script>` can't break out:

```dart
String _injectData(String template, Map<String, Object?> data) =>
    template.replaceFirst('/*__DATA__*/', 'window.__DATA__ = ${jsonEncode(data).replaceAll('<', r'<')};');
```

Put the **bundle builder in one reusable method** (`buildBundle` → zip entries + headline
counts). Both the share path and the export path call it — so a record opened from an export
renders identically to one opened from a share, minus the encryption. Reading each attachment
goes through `flutter-encryption-at-rest`'s `readDecrypted`; a missing/corrupt file must
`continue`, never sink the whole bundle.

**Section toggles are independent, and exclusion is total.** Give each slice its own include
flag (e.g. history, appointments, medications, people) rather than folding one into another.
When a slice is excluded, also strip every cross-reference to it from the slices that remain
(an entry's `personId`, say) — the viewer must never point at data the archive doesn't carry,
and a dangling id still leaks that the thing exists.

**Ship small previews, not full images, for the viewer's cards.** If the app already caches
thumbnails, bundle them beside the originals and add a `thumb` path to each file descriptor;
the viewer uses it for cards/tiles and opens the original only in the lightbox. Otherwise the
browser decodes every full-resolution page just to draw a 74px tile, and a PDF gets a real
first-page preview instead of a generic icon.

### Archive layout for people, not the viewer

Many recipients skip the viewer and download the zip. Lay it out for a file manager:

```
Open me - Knee injury.html                     <- viewer page, localized "Open me", titled
2026/
  2026-09-14 - Blood test (3f9a1c2e)/          <- year / local date - title (short id)
    Blood test - 1.jpg
    labs.pdf                                   <- user's original name, kept
_viewer/                                       <- viewer-only assets, out of the way
  thumbs/<record id>/labs.pdf.thumb.jpg
  people/<id>.jpg
```

- **Always append the short id** (first 8 chars) to a record folder, not only on a clash — the
  name is then unique *and* stable across repeated shares. Only records with at least one
  bundled file get a folder.
- **Name the viewer page for what it is** (`Open me - <title>.html`, localized) — a bare
  `index.html` among the documents says nothing to a person.
- Keep original file names; derived names are `<title> - N.ext`. Name a thumbnail
  `<file>.thumb.jpg` (append, don't swap the extension) so `labs.pdf` and `labs.jpg` can't
  collide.
- Give "download all" a readable name too (`<App> - <title> - <date>.zip`), injected into the
  viewer data and passed to the loader (§1).

The sanitizer must stay **readable but safe** — the old `[^A-Za-z0-9._-] → '-'` slug turns
every accented or CJK title into dashes:

```dart
static final _illegal = RegExp(r'[\\/:*?"<>|\x00-\x1F\x7F]');   // Windows/macOS/zip-illegal
static final _reserved = RegExp(r'^(con|prn|aux|nul|com[0-9]|lpt[0-9])$', caseSensitive: false);

static String readableFileName(String raw, {String fallback = 'file'}) {
  var s = raw.replaceAll(_illegal, ' ').replaceAll(RegExp(r'\s+'), ' ').trim(); // keep case, accents, CJK
  final runes = s.runes;                                   // cap by runes, never split a code point
  if (runes.length > 60) s = String.fromCharCodes(runes.take(60));
  s = s.replaceAll(RegExp(r'^[\s.]+|[\s.]+$'), '');        // Windows drops trailing dots/spaces
  if (s.isEmpty) return fallback;
  return _reserved.hasMatch(s.split('.').first) ? '_$s' : s; // CON.pdf, nul.txt …
}

/// `name`, else `name (2).ext`, `name (3).ext` … — compared case-insensitively, because
/// Windows and macOS unzip `Labs.pdf` and `labs.pdf` onto the same file.
static String unique(String name, Set<String> used) {
  if (used.add(name.toLowerCase())) return name;
  final dot = name.lastIndexOf('.');
  final stem = dot > 0 ? name.substring(0, dot) : name, ext = dot > 0 ? name.substring(dot) : '';
  for (var n = 2; ; n++) { final c = '$stem ($n)$ext'; if (used.add(c.toLowerCase())) return c; }
}
```

Sanitize a file name's stem and extension separately so truncation never cuts through `.pdf`.

**The viewer resolves paths two ways.** Inside the loader, paths map to blob URLs. Opened
straight from an unzipped folder, they are relative URLs — so **percent-encode each segment**,
or spaces, accents and a stray `#` break every image:

```js
function fileUrl(path) {
  if (FILES && FILES[path]) return FILES[path];               // loader: blob URL
  return path.split("/").map(encodeURIComponent).join("/");  // unzipped: relative URL
}
```

## 5. `prepare` vs. `upload` (size gate before network)

Split the CPU-bound packaging from the network so the UI can confirm a large upload first:

```dart
Future<PreparedShare> prepare(...) async {
  final entries = (await buildBundle(...)).entries;
  return PreparedShare(zipBytes: await Isolate.run(() => buildZip(entries)), fileCount: entries.length);
} // no network — caller inspects sizeBytes and confirms

Future<ShareResult> upload({required PreparedShare prepared, required String shareId, ...}) async {
  onProgress?.call(1);
  final sealed = await _codec.seal(prepared.zipBytes);                 // encrypt
  onProgress?.call(2);
  if (!await _drive.isAvailable()) await _drive.connect();             // interactive if needed
  final fileId = await _drive.uploadPublic(sealed.bytes, name: _archiveName(...),
      onProgress: (sent, total) => onUploadProgress?.call(total == 0 ? 1 : sent / total));
  onProgress?.call(3);
  final key = base64Url.encode(sealed.key);
  await _repos.shares.insert(Share(id: shareId, driveFileId: fileId, decryptionKey: key, ...)); // record it
  return ShareResult(link: linkFor(driveFileId: fileId, decryptionKey: key));
}
```

`buildZip` (deflate each entry, level 6) is pure-Dart CPU work — run it on `Isolate.run` too so
the "packaging" spinner doesn't jank. A hand-written zip writer must set **general-purpose flag
bit 11 (`0x0800`, names are UTF-8)** in both the local and the central-directory header;
without it Windows Explorer decodes names as CP437 and garbles every non-ASCII title.

## 6. Revoke, record, manage

- **Record every share** in a table (`shares`: id, source id, driveFileId, decryptionKey,
  createdAt, sizeBytes, range/filters). This powers a "manage shares" screen.
- **Revoke = delete the Drive file** (`_drive.delete(driveFileId)`) and remove the row. The link
  dies immediately.
- Store the key in your DB so the owner can re-copy the link later; it's on-device only.

## 7. Export: the same bundle, in the clear

Export is share minus encryption and network: iterate every record set, call the **same
`buildBundle`**, nest each under its own readable folder (`<title> (<short id>)/`, through the
same sanitizer + `unique`), add a landing page (`Open me - <localized export title>.html`, a
static asset with the list injected at `/*__DATA__*/`), and zip it. The result opens straight
from a file manager — the whole point is a portable copy the user owns with no lock-in. Offer
it through the OS "save-as" dialog.

```dart
for (final set in sets) {
  final bundle = await _share.buildBundle(set: set, isExport: true, ...); // returns its htmlName
  final folder = ArchivePaths.unique(ArchivePaths.setFolder(set), usedFolders);
  for (final e in bundle.entries) entries.add(ShareZipEntry('$folder/${e.name}', e.bytes));
  // an href is a URL, not a path: encode, since names carry spaces and non-ASCII
  cards.add({'href': '${Uri.encodeComponent(folder)}/${Uri.encodeComponent(bundle.htmlName)}', ...});
}
entries.insert(0, ShareZipEntry(openMeName, utf8.encode(_injectData(landingTemplate, listData))));
return ExportArchive(zipBytes: ShareService.buildZip(entries), ...);
```

Provide a cheap `summarize()` (counts only, no decryption/zip) for a pre-flight consent sheet;
the exact figures come from the real build.

## 8. Gotchas

- **Key in the fragment, never uploaded** — `#…` isn't sent to servers; that's the whole
  security model. Upload only ciphertext.
- **Fresh random key per share** (not a derived/owner key) — the recipient has no password.
- **Bare GCM concatenation output** so the browser's WebCrypto decrypts it with no custom parser.
- **Encrypt and zip on a background isolate** — pure-Dart AES-GCM/deflate janks the UI on
  multi-MB archives; pass raw key bytes across (a `SecretKey` can't cross the boundary).
- **Escape `<` when injecting JSON** into the HTML template (XSS / script-breakout).
- **A bad attachment must `continue`**, not throw — one corrupt page shouldn't sink the bundle.
- **Lay the zip out for people** — dated, titled folders with an always-present short id,
  viewer assets in `_viewer/`, an "Open me" page; never `index.html` + `files/<uuid>/`.
- **Readable, not slugged, names** — keep Unicode; strip Windows-illegal chars and reserved
  device names; cap by runes; dedupe case-insensitively as `name (2).ext`.
- **Set the zip UTF-8 name flag (bit 11)** in local and central headers, or Windows garbles
  non-ASCII names.
- **Percent-encode per segment** when the viewer or landing page turns a zip path into a
  relative URL.
- **The loader must open every archive ever shared** — find the entry page tolerantly, deploy
  the loader before the app, and give every new `postMessage` field a fallback.
- **Excluding a section drops its cross-references** from the rest of the data.
- **Split `prepare` (offline, sized) from `upload` (network)** so the user confirms big uploads.
- **Revoke by deleting the file**; record shares in a table to manage/re-copy/revoke them.
- **Export is unencrypted by design** — it's the user's own copy; don't add friction, but do
  gate it behind a clear consent sheet since it decrypts everything.
