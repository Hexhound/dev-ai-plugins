#!/usr/bin/env bash
# Builds and installs the "No keyboard" input method on the capture device, and makes it the
# only one: the takes type into fields with no on-screen keyboard coming up (a keyboard that
# opens and closes between fields makes the form jump). Needs ANDROID_SDK_ROOT (build-tools
# 35, platform 35), a JDK and adb.
#   capture/android/nokeyboard/build.sh [out-dir]   → <out-dir>/nokeyboard.apk (default
#                                                     $TMPDIR/nokeyboard), installed and set
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
gen=${1:-${TMPDIR:-/tmp}/nokeyboard}
out=$gen/build
bt=$ANDROID_SDK_ROOT/build-tools/35.0.0
jar=$ANDROID_SDK_ROOT/platforms/android-35/android.jar
ime=dev.promo.nokeyboard/.NoKeyboard
rm -rf "$out" && mkdir -p "$out/classes" "$out/dex"
javac --release 11 -classpath "$jar" -d "$out/classes" $(find "$here/src" -name '*.java')
"$bt/d8" --min-api 26 --lib "$jar" --output "$out/dex" $(find "$out/classes" -name '*.class')
"$bt/aapt2" compile --dir "$here/res" -o "$out/res.zip"
"$bt/aapt2" link -I "$jar" --manifest "$here/AndroidManifest.xml" -o "$out/unsigned.apk" "$out/res.zip"
(cd "$out/dex" && zip -q "$out/unsigned.apk" classes.dex)
"$bt/zipalign" -f 4 "$out/unsigned.apk" "$out/aligned.apk"
# A throwaway signing key; a new one makes the next install a different app, hence the uninstall.
keytool -genkeypair -keystore "$out/key.jks" -storepass promo00 -keypass promo00 -alias promo \
  -keyalg RSA -keysize 2048 -validity 3650 -dname CN=promo >/dev/null 2>&1
"$bt/apksigner" sign --ks "$out/key.jks" --ks-pass pass:promo00 --out "$gen/nokeyboard.apk" "$out/aligned.apk"
adb uninstall dev.promo.nokeyboard >/dev/null 2>&1 || true
adb install "$gen/nokeyboard.apk" | tail -1
# The system takes a moment to list a newly installed input method.
for _ in $(seq 1 20); do adb shell ime list -a -s | tr -d '\r' | grep -qx "$ime" && break; sleep 0.5; done
adb shell ime enable $ime >/dev/null
adb shell ime set $ime >/dev/null
# Every other input method off, or the system may switch back to one.
for m in $(adb shell ime list -s | tr -d '\r'); do
  [ "$m" = "$ime" ] || adb shell ime disable "$m" >/dev/null
done
echo "input method: $(adb shell settings get secure default_input_method | tr -d '\r')"
