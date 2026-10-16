#!/usr/bin/env bash
# Builds a signed, installable Android APK of the meal planner (works offline, keeps its data on the phone).
# Needs: aapt, dx, zipalign, apksigner, keytool, javac and an android.jar (apt: aapt dalvik-exchange
# apksigner zipalign android-sdk-platform-23 default-jdk-headless).
# Output: android/build/meal-planner.apk, signed with android/meal-planner.keystore (created on first run;
# keep it: later versions must be signed with the same key to install over this one).
set -euo pipefail
cd "$(dirname "$0")/.."

SDK_JAR=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
OUT=android/build
KEYSTORE=${KEYSTORE:-android/meal-planner.keystore}
PASS=${KEYSTORE_PASSWORD:-mealplanner}

npm run --silent build:artifact
rm -rf "$OUT" && mkdir -p "$OUT/classes" "$OUT/gen" "$OUT/assets"
cp artifact/dist/standalone/index.html "$OUT/assets/index.html"

aapt package -f -m -J "$OUT/gen" -M android/AndroidManifest.xml -S android/res -I "$SDK_JAR" \
  -F "$OUT/unsigned.apk" -A "$OUT/assets"
javac --release 8 -Xlint:-options -cp "$SDK_JAR" -d "$OUT/classes" \
  $(find android/src "$OUT/gen" -name '*.java')
"${DX:-/usr/lib/android-sdk/build-tools/debian/dx}" --dex --output="$OUT/classes.dex" "$OUT/classes"
(cd "$OUT" && aapt add -f unsigned.apk classes.dex >/dev/null)

if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -storepass "$PASS" -keypass "$PASS" -alias meal-planner \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Meal Planner" >/dev/null
fi
zipalign -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
apksigner sign --ks "$KEYSTORE" --ks-pass "pass:$PASS" --key-pass "pass:$PASS" \
  --out "$OUT/meal-planner.apk" "$OUT/aligned.apk"
apksigner verify "$OUT/meal-planner.apk"
aapt dump badging "$OUT/meal-planner.apk" | grep -E "^(package|sdkVersion|application-label|launchable)"
ls -l "$OUT/meal-planner.apk"
