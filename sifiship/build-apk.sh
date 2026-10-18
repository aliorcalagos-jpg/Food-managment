#!/usr/bin/env bash
# Builds the signed, installable Android APK of SIFIship (Android 7+, works offline).
# Needs: aapt, dx, zipalign, apksigner, keytool, javac and an android.jar (apt: aapt dalvik-exchange
# apksigner zipalign android-sdk-platform-23 default-jdk-headless).
# Output: sifiship/dist/SIFIship-V.6.apk, signed with sifiship/android/sifiship.keystore (created on first run;
# keep it: later versions must be signed with the same key to install over this one).
set -euo pipefail
cd "$(dirname "$0")"

SDK_JAR=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
OUT=android/build
APK=dist/SIFIship-V.6.apk
KEYSTORE=${KEYSTORE:-android/sifiship.keystore}
PASS=${KEYSTORE_PASSWORD:-sifiship}

node --test test/logic.check.mjs test/progress.check.mjs test/pass.check.mjs >/dev/null
rm -rf "$OUT" && mkdir -p "$OUT/classes" "$OUT/gen" "$OUT/assets" dist
cp -r web/. "$OUT/assets/"

aapt package -f -m -J "$OUT/gen" -M android/AndroidManifest.xml -S android/res -I "$SDK_JAR" \
  -F "$OUT/unsigned.apk" -A "$OUT/assets"
javac --release 8 -Xlint:-options -cp "$SDK_JAR" -d "$OUT/classes" \
  $(find android/src "$OUT/gen" -name '*.java')
"${DX:-/usr/lib/android-sdk/build-tools/debian/dx}" --dex --output="$OUT/classes.dex" "$OUT/classes"
(cd "$OUT" && aapt add -f unsigned.apk classes.dex >/dev/null)

if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -storepass "$PASS" -keypass "$PASS" -alias sifiship \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=SIFIship" >/dev/null
fi
zipalign -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
apksigner sign --ks "$KEYSTORE" --ks-pass "pass:$PASS" --key-pass "pass:$PASS" --out "$APK" "$OUT/aligned.apk"
apksigner verify "$APK"
aapt dump badging "$APK" | grep -E "^(package|sdkVersion|application-label|launchable)"
ls -l "$APK"
