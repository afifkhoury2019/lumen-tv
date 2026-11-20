# Lumen TV

A simple IPTV player for Android, built with React Native and Expo.

- Load any M3U / M3U8 playlist from a link
- Browse channels by category, with search
- Mark favorites (saved on the device)
- Full-screen landscape playback and picture-in-picture

Lumen TV does not include any channels. Use playlists you have the right to watch.

## Download

Every push to `main` builds a new APK with GitHub Actions. Get it from the
[Releases page](../../releases/tag/latest) (`lumen-tv.apk`), then open it on your phone and allow
"Install unknown apps" when Android asks.

## Develop

```bash
npm install
npx expo run:android   # needs JDK 17 + Android SDK
npx tsc --noEmit       # type-check
```

## Signing

The CI build is signed with the default debug keystore, so it installs fine but can't go on the
Play Store. To publish there, add your own keystore and release signing config (or use EAS Build).
