---
name: flutter-admob-native-ads
description: Use when adding Google AdMob native ads to a Flutter app — in-feed/timeline/list ad slots that match the app's card design, with GDPR/UMP consent gating and a kill-switch that hides every ad once the user pays to remove them.
---

# AdMob native ads (design-matched, consent-gated)

Integrate Google AdMob **native** ads that render as cards matching your own UI (not a
Google banner), request only after UMP/GDPR consent is resolved, and disappear the moment
a "remove ads" flag flips. This is the pattern proven in the caremate app across four
in-list placements.

Pairs with `flutter-remove-ads-iap` (the purchase that flips the flag) and
`flutter-scope-dependency-injection` (how the flag reaches each slot).

## Contents

1. Architecture — the four moving parts
2. Dependency & platform setup
3. `AdConfig` — per-slot unit IDs, test/prod, the two switches
4. `AdConsent` — the UMP consent gate
5. Startup wiring (order matters)
6. `NativeAdSlot` — the load-once widget
7. Rendering: Dart-only template vs. native factory
8. Gating slots behind "ads removed"
9. Gotchas

## 1. Architecture

Four parts, each with one job:

- **`AdConfig`** — static config: which ad-unit ID per placement, test-vs-prod, and the two
  switches (`enabled`, `showPlaceholder`) that decide whether a slot loads an ad, draws a
  stand-in, or collapses.
- **`AdConsent`** — runs Google's UMP consent flow once at startup and exposes a
  `ValueNotifier<bool> canRequestAds` gate.
- **`NativeAdSlot`** — a `StatefulWidget` that owns exactly one `NativeAd`, loads it only
  after the gate opens, and until an ad actually loads collapses to zero height in release
  (labelled stand-in in debug).
- **A remove-ads flag** — a persisted bool every slot's parent checks before inserting a
  `NativeAdSlot` into the list at all.

## 2. Dependency & platform setup

```yaml
dependencies:
  google_mobile_ads: ^5.3.1
```

**Android** — put the App ID (from the AdMob console) in `AndroidManifest.xml` inside
`<application>`:

```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"/>
```

Use Google's public **sample App ID** (`ca-app-pub-3940256099942544~3347511713`) until you
have a real account — a wrong/empty App ID crashes on init.

**iOS** — the equivalent `GADApplicationIdentifier` key in `Info.plist`.

## 3. `AdConfig` — per-slot IDs, test/prod, the two switches

Model placements as an **enum**, not bare strings, so adding a slot is a compile error until
it has an ID in every platform map. Two switches decide what a slot does: `enabled` (may it
request a real ad) and `showPlaceholder` (may it draw a stand-in when it has no ad). **Both
default to `false`** and are turned on by `configureForRuntime()`, called from `main()` —
see §5.

```dart
import 'package:flutter/foundation.dart';  // NOT dart:io — see the two bugs below

enum AdSlot {
  home('Home'),
  feed('Feed'),
  history('History');

  const AdSlot(this.label);

  /// Shown on the debug stand-in so it is obvious which slot you are looking at.
  final String label;
}

class AdConfig {
  AdConfig._();

  static const _testAndroid = 'ca-app-pub-3940256099942544/2247696110'; // Google test units
  static const _testIos     = 'ca-app-pub-3940256099942544/3986624511';

  static const Map<AdSlot, String> _prodAndroid = { /* real unit IDs, '' until filled */ };
  static const Map<AdSlot, String> _prodIos     = { /* ... */ };

  /// Height a slot occupies, matching your template/layout. The stand-in uses the same
  /// number, so the layout you review in debug is the layout you ship.
  static const slotHeight = 94.0;

  /// An ad goes after every Nth item, never in the trailing position (§8).
  static const adEveryN = 3;

  /// Whether a slot may request a real ad.
  static bool enabled = false;

  /// Whether a slot with no ad to show draws a labelled stand-in instead of collapsing.
  static bool showPlaceholder = false;

  /// True when a slot could show *something* — a real ad or the stand-in. When neither is
  /// possible there is no reason to build a slot at all: no widget, no listener on the
  /// consent gate, no wasted element.
  static bool get slotsCanRender => enabled || showPlaceholder;

  /// Debug builds always use test ads; release uses test ads only while prod IDs are blank.
  static bool get useTestAds => kDebugMode;

  static bool get _isAndroid =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  /// The AdMob SDK exists on Android and iOS only.
  static bool get supportsAds =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);

  /// Opt in to real (test-unit) ad requests from a debug build. Off by default: while
  /// developing you get the stand-in and nothing else, so no network, no AdMob account and
  /// no SDK are needed to work on the layout. Flip it to verify the real integration on a
  /// device — it still requests Google's *test* units, never live ones.
  static bool useRealAdsInDebug = false;

  /// Called once from `main()`.
  ///
  /// Release on a phone   → real ads; a slot with nothing to show collapses.
  /// Debug on a phone     → the stand-in only, unless [useRealAdsInDebug] is set.
  /// Debug on desktop/web → no SDK exists, so the stand-in is all there is — which is how
  ///                        the layout gets reviewed while developing.
  static void configureForRuntime() {
    enabled = supportsAds && (!kDebugMode || useRealAdsInDebug);
    showPlaceholder = kDebugMode;
  }

  static String unitId(AdSlot slot) {
    if (useTestAds) return _isAndroid ? _testAndroid : _testIos;
    final prod = _isAndroid ? _prodAndroid[slot] : _prodIos[slot];
    // Fail safe to the test unit rather than requesting an empty/invalid unit.
    return (prod == null || prod.isEmpty) ? (_isAndroid ? _testAndroid : _testIos) : prod;
  }
}
```

Two portability bugs the explicit switches avoid — both are easy to write and neither shows
up on the device you develop on:

- **Don't reach for `dart:io`'s `Platform.isAndroid`.** Importing `dart:io` breaks
  `flutter build web` outright. `defaultTargetPlatform` from `package:flutter/foundation.dart`
  does the same job and is web-safe.
- **Don't derive `enabled` by sniffing the environment.** An expression like
  `!kIsWeb && !isFlutterTest` excludes web and `flutter test` but *not* desktop, so a
  Linux/macOS/Windows debug run reports enabled and the SDK throws. Defaulting both switches
  to `false` and opting in from `main()` also deletes the
  `Platform.environment['FLUTTER_TEST']` check entirely: widget tests build the app widget
  directly and never call `main()`, so they are off by construction rather than by sniffing.

Per-slot prod IDs let you track fill/revenue per placement. **Never ship your real unit IDs
requesting against a debug build** — always `useTestAds` in debug, or AdMob may flag the
account for invalid traffic.

## 4. `AdConsent` — the UMP consent gate

Under GDPR, EEA/UK/CH users must consent before an ad request. UMP fetches the messaging
config, shows Google's form only when required, records the choice, and reports whether ads
may be requested. Everywhere else it resolves instantly with no form.

```dart
class AdConsent {
  AdConsent._();

  /// Flips true only after consent is resolved AND the SDK is initialized.
  /// Every NativeAdSlot listens to this and loads only when it becomes true.
  static final ValueNotifier<bool> canRequestAds = ValueNotifier<bool>(false);

  static Future<bool> gather() async {
    final completer = Completer<void>();
    ConsentInformation.instance.requestConsentInfoUpdate(
      ConsentRequestParameters(consentDebugSettings: _debugSettings),
      () async {
        await ConsentForm.loadAndShowConsentFormIfRequired((_) {
          if (!completer.isCompleted) completer.complete();
        });
      },
      (_) { if (!completer.isCompleted) completer.complete(); }, // errors -> proceed
    );
    await completer.future;
    return ConsentInformation.instance.canRequestAds();
  }

  /// A "Privacy options" row in Settings can re-open the form later:
  static void showPrivacyOptions() =>
      ConsentForm.showPrivacyOptionsForm((_) {});
}
```

**Testing consent without a VPN:** in debug only, pass `ConsentDebugSettings(debugGeography:
DebugGeography.debugGeographyEea, testIdentifiers: [hashedId])`. Get the hashed id by running
once with an empty list and reading logcat for
`addTestDeviceHashedId("…")`. Send `null` in release.

## 5. Startup wiring (order matters)

Gather consent **before** initializing the SDK, and open the gate **only after both** —
otherwise a request can go out before consent is resolved. Run it in the background so it
never blocks first paint; slots stay empty until the gate opens:

```dart
// in main(), after WidgetsFlutterBinding.ensureInitialized()
AdConfig.configureForRuntime();   // the only place the two switches are turned on
if (AdConfig.enabled) {
  unawaited(() async {
    final consented = await AdConsent.gather();
    if (!consented) return;                       // declined -> no ads, gate stays shut
    await MobileAds.instance.initialize();
    AdConsent.canRequestAds.value = true;         // open the gate
  }());
}
```

## 6. `NativeAdSlot` — the load-once widget

Owns one `NativeAd`, waits for the gate, and cleans up on dispose. **No placeholder in
release** — a slot that failed or is still loading collapses to `SizedBox.shrink()` so the
list never shows an empty box. In debug it draws a labelled stand-in of the same height
instead, so the slot's footprint stays reviewable while developing (§9):

```dart
class _NativeAdSlotState extends State<NativeAdSlot> {
  NativeAd? _ad;
  bool _loaded = false;
  bool _requested = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_requested) return;               // fire once
    _requested = true;
    AdConsent.canRequestAds.addListener(_maybeLoad);
    _maybeLoad();                          // load now if the gate is already open
  }

  void _maybeLoad() {
    if (!mounted || _ad != null) return;
    if (!AdConfig.enabled || !AdConsent.canRequestAds.value) return;
    _load();
  }

  void _load() {
    final ad = NativeAd(
      adUnitId: AdConfig.unitId(widget.slot),
      request: const AdRequest(),
      // choose ONE rendering path — see §7
      listener: NativeAdListener(
        onAdLoaded: (_) { if (mounted) setState(() => _loaded = true); },
        onAdFailedToLoad: (ad, _) {          // show nothing, free resources
          ad.dispose();
          if (mounted && identical(ad, _ad)) setState(() { _ad = null; _loaded = false; });
        },
      ),
    );
    _ad = ad;
    try { ad.load().catchError((_) {}); } catch (_) { _ad = null; } // missing plugin -> silent
  }

  @override
  void dispose() {
    AdConsent.canRequestAds.removeListener(_maybeLoad);
    _ad?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loaded && _ad != null) {
      return SizedBox(height: AdConfig.slotHeight, child: AdWidget(ad: _ad!));
    }
    if (AdConfig.showPlaceholder) return AdSlotStandIn(slot: widget.slot);
    return const SizedBox.shrink();
  }
}
```

The stand-in occupies `AdConfig.slotHeight` — the same box the real ad gets — and should look
*deliberately unfinished*. It is a development aid; mistaking it for shippable UI would be
worse than not having it:

```dart
class AdSlotStandIn extends StatelessWidget {
  const AdSlotStandIn({super.key, required this.slot});

  final AdSlot slot;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: AdConfig.slotHeight,          // identical footprint to the real ad
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: /* faint fill */,
            border: Border.all(color: /* faint outline */),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            // Naming the slot and the height makes the placement obvious at a glance.
            child: Text('AD SLOT · ${slot.label} · ${AdConfig.slotHeight.toInt()}px'),
          ),
        ),
      );
}
```

## 7. Rendering: two paths

**a) Dart-only template (fast, no native code).** Pass a `nativeTemplateStyle` to the
`NativeAd` with `TemplateType.small`/`medium` and colors from your theme. Zero platform code
— start here.

**b) Custom native factory (design-matched card — what caremate ships).** Register a native
`NativeAdFactory` that inflates your own layout so the ad is indistinguishable from a real
card. `factoryId` must match on both sides.

- Android — in `MainActivity.configureFlutterEngine`:
  ```kotlin
  GoogleMobileAdsPlugin.registerNativeAdFactory(
      flutterEngine, "cardFactory", NativeAdCardFactory(layoutInflater))
  ```
  and unregister in `cleanUpFlutterEngine`. `NativeAdCardFactory` inflates an XML layout
  (`res/layout/native_ad_card.xml`) and binds headline/icon/CTA to the `NativeAd`.
- Pass theme colors from Dart via `NativeAd(customOptions: {...})` as `#AARRGGBB` strings so
  the native card tracks light/dark:
  ```dart
  customOptions: { 'surface': _hex(c.surface), 'ink': _hex(c.ink), 'accent': _hex(c.accent) }
  ```
  Read them in the factory (`options["surface"] as String`) and apply. Keep the XML view ids
  in sync with the factory.

Use (a) to ship quickly; move to (b) when the ad must visually match your cards.

## 8. Gating slots behind "ads removed"

The slot widget only gates on *consent*. Whether a slot exists at all is the **parent's**
decision, checked against a persisted `adsRemoved` flag so paying users never even build one:

```dart
// building a feed list
final last = items.length - 1;
for (final (i, item) in items.indexed) {
  widgets.add(itemTile(item));
  final atAdPosition = (i + 1) % AdConfig.adEveryN == 0 && i != last;
  if (!adsRemoved && AdConfig.slotsCanRender && atAdPosition) {
    widgets.add(NativeAdSlot(slot: AdSlot.feed));
  }
}
```

The `i != last` guard matters: `(i + 1) % adEveryN == 0` on its own puts an ad in the
**trailing** slot whenever the list length is an exact multiple of N — a 6-item feed with
`adEveryN == 3` ends on an ad with no content under it, which reads as a mis-render rather
than as in-feed content. Ads belong *between* items.

Checking `AdConfig.slotsCanRender` in the same condition means a build that can show neither
a real ad nor a stand-in never constructs the widget at all — no element, no listener on the
consent gate.

`adsRemoved` comes from your settings store; `flutter-remove-ads-iap` flips it on a verified
purchase. Because it's checked at list-build time, removing ads is instant on the next
rebuild — no ad teardown needed.

## 9. Gotchas

- **Never request live ads in debug** — always `useTestAds` in `kDebugMode`, or risk an
  invalid-traffic strike.
- **Consent before init before gate.** Reordering any of the three can fire a request before
  consent resolves — a policy violation.
- **Tests are off by construction.** The AdMob platform channel isn't registered under
  `flutter test`, so a slot that requests an ad there throws. Because both switches default
  to `false` and only `main()` turns them on, a widget test that builds the app widget
  directly never gets one — no `FLUTTER_TEST` environment sniff required.
- **The SDK is Android/iOS only — web is not the only exception.** A kill-switch that
  excludes web still reports enabled on a desktop debug run, where the SDK throws. Gate on
  `defaultTargetPlatform`, and never import `dart:io` for it (`Platform` breaks
  `flutter build web`).
- **One `NativeAd` per widget, disposed with it.** Ads hold native resources; a leaked ad is
  a memory leak. Use `identical(ad, _ad)` before clearing state in the fail callback so a
  late failure from a superseded ad can't wipe a newer one.
- **No placeholder in release.** Rendering an empty box while a real ad loads causes visible
  layout jumps, so a release slot collapses to zero. In debug, render a labelled stand-in of
  the same height instead — the slot's footprint has to be reviewable while developing, and
  on desktop/web the SDK doesn't exist at all so the stand-in is the only thing there is to
  see.
- **`AdWidget` needs a bounded height.** Wrap it in a fixed-height `SizedBox` matching your
  template/layout, or it fails to lay out in a scroll view.
