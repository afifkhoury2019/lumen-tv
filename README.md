# Lumen TV

A simple IPTV player for Android, built with React Native and Expo.

- Sign in to your IPTV subscription with **server + username + password** (Xtream Codes API), or paste an **M3U link**
- **Live TV**, **Movies** and **Series** (with seasons and episodes), grouped by your provider's categories
- Search, favorites and recently watched
- Player with previous / next channel, automatic stream-format fallback, full-screen landscape and picture-in-picture
- Account page with subscription status, expiry date and connections

- One-tap **free channels** (no subscription needed):
  - Arabic: about 360 channels from [iptv-org](https://github.com/iptv-org/iptv) (re-tested daily by
    `.github/workflows/check-streams.yml`; only working streams are kept in `playlists/arabic.m3u`)
    plus the Arabic lists of [Free-TV/IPTV](https://github.com/Free-TV/IPTV)
  - Free-TV worldwide: about 2,200 channels, loaded straight from the Free-TV repository
  - iptv-org worldwide: about 12,000 channels

Your login is stored only on your device, in encrypted storage (`expo-secure-store`). It is never
part of this repository.

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
