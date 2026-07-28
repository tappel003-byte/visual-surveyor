I checked the live published metadata with an iPad Safari user agent. The main page and `/survey.html` now correctly say **PGG**, but `/manifest.webmanifest` is still being generated as a separate default manifest with `pgg-photo-documentation` and a generic theme. That gives iOS/iPadOS another app identity to latch onto, especially on a device that previously cached the old shortcut.

Plan:

1. Make there be only one app identity
   - Update the PWA plugin config so the generated `/manifest.webmanifest` also says **PGG** with the same icon, colors, `id`, `scope`, and `start_url` as `/manifest-pgg.webmanifest`.
   - Keep the existing `/manifest-pgg.webmanifest` link for continuity, but eliminate the conflicting generated metadata.

2. Simplify iPad shortcut entry point
   - Make the install `start_url` point consistently at `/survey.html?pwa=pgg-v6`.
   - Keep root `/` metadata aligned, because Add to Home Screen may be launched from either `/` or `/survey.html`.

3. Preserve the cache cleanup
   - Keep the temporary service-worker kill-switch so older cached shells can be cleared.
   - Do not add offline behavior or rebuild the app.

4. Verify after the change
   - Check the served `/`, `/survey.html`, `/manifest.webmanifest`, and `/manifest-pgg.webmanifest` outputs.
   - Confirm no served metadata references the old or generic app name.

What this means practically: you are not doing something wrong. Your iPhone likely saw the correct manifest, while the iPad mini is probably still combining old cached Add-to-Home-Screen data with the remaining conflicting manifest endpoint. This plan removes that ambiguity.